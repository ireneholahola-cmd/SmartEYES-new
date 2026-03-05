"""
Neo4j WebSocket 桥接服务（增强版）
支持自动探测图谱结构、增量更新、心跳检测、多客户端管理

运行方式: uvicorn neo4j_ws_bridge:app --reload --port 8000
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase
import asyncio
import json
from typing import List, Dict, Any, Set
from dataclasses import dataclass, field
from datetime import datetime
import os
import hashlib

app = FastAPI(title="Neo4j WebSocket Bridge")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Neo4j 连接配置
NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "88888888")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

driver = None

def get_driver():
    global driver
    if driver is None:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    return driver


@dataclass
class GraphState:
    """图谱状态缓存，用于计算增量更新"""
    nodes: Dict[str, Dict] = field(default_factory=dict)
    links: Set[tuple] = field(default_factory=set)
    last_hash: str = ""
    
    def compute_hash(self) -> str:
        """计算当前状态的哈希值（包含节点关键属性）"""
        # 构造节点指纹：ID + 速度 + 类型 + 车道ID
        node_sigs = []
        for n_id, n in self.nodes.items():
            # 简化属性提取，重点关注变化的量
            speed = n.get("speed", 0)
            lane = n.get("laneId", "")
            x = n.get("x", 0) # 如果未来支持后端坐标
            y = n.get("y", 0)
            node_sigs.append(f"{n_id}|{speed}|{lane}|{x}|{y}")
            
        data = json.dumps(sorted(node_sigs) + sorted(str(l) for l in self.links))
        return hashlib.md5(data.encode()).hexdigest()


# 全局状态缓存
graph_state = GraphState()


def get_schema() -> Dict[str, Any]:
    """
    探测 Neo4j 数据库结构
    返回: { labels: [...], relationshipTypes: [...], sample: [...] }
    """
    driver = get_driver()
    schema = {"labels": [], "relationshipTypes": [], "sample": []}
    
    with driver.session(database=NEO4J_DATABASE) as session:
        # 获取所有节点标签
        result = session.run("CALL db.labels()")
        schema["labels"] = [record["label"] for record in result]
        
        # 获取所有关系类型
        result = session.run("CALL db.relationshipTypes()")
        schema["relationshipTypes"] = [record["relationshipType"] for record in result]
        
        # 获取示例节点
        result = session.run("""
            MATCH (n) 
            RETURN labels(n) AS labels, keys(n) AS properties, n AS node
            LIMIT 5
        """)
        for record in result:
            schema["sample"].append({
                "labels": record["labels"],
                "properties": record["properties"],
                "data": dict(record["node"]) if record["node"] else {}
            })
    
    return schema


def get_neo4j_graph() -> Dict[str, Any]:
    """
    从 Neo4j 获取当前图谱状态（通用版本）
    自动探测并返回所有节点和关系
    """
    driver = get_driver()
    nodes = []
    links = []
    seen_nodes = set()
    
    with driver.session(database=NEO4J_DATABASE) as session:
        # 通用查询：获取所有节点
        node_query = """
        MATCH (n)
        RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS props
        LIMIT 300
        """
        result = session.run(node_query)
        
        for record in result:
            node_id = str(record["id"])
            labels = record["labels"]
            props = record["props"] or {}
            
            if node_id not in seen_nodes:
                # 确定节点类型
                node_type = labels[0] if labels else "Unknown"
                
                # 尝试获取显示名称
                name = (props.get("name") or 
                       props.get("id") or 
                       props.get("title") or 
                       props.get("v_id") or
                       node_id[:8])
                
                # 如果是车辆类型，显示速度
                if "Vehicle" in labels or "vehicle" in str(labels).lower():
                    speed = props.get("speed") or props.get("v_speed")
                    if speed:
                        name = f"车:{speed}km/h"
                
                nodes.append({
                    "id": node_id,
                    "name": str(name),
                    "type": node_type,
                    "speed": props.get("speed") or props.get("v_speed"),
                    "laneId": props.get("lane_id") or props.get("laneId"),
                    "properties": props  # 保留完整属性
                })
                seen_nodes.add(node_id)
        
        # 通用查询：获取所有关系
        rel_query = """
        MATCH (a)-[r]->(b)
        RETURN elementId(a) AS source, elementId(b) AS target, type(r) AS relType
        LIMIT 500
        """
        result = session.run(rel_query)
        
        for record in result:
            source = str(record["source"])
            target = str(record["target"])
            
            # 只添加存在的节点之间的关系
            if source in seen_nodes and target in seen_nodes:
                links.append({
                    "source": source,
                    "target": target,
                    "type": record["relType"]
                })
    
    return {"nodes": nodes, "links": links}


# 存储活跃的 WebSocket 连接
@dataclass
class Connection:
    websocket: WebSocket
    last_state_hash: str = ""


active_connections: Dict[int, Connection] = {}


@app.get("/api/neo4j/schema")
async def get_database_schema():
    """HTTP 接口：探测数据库结构"""
    try:
        schema = get_schema()
        return {"status": "success", "schema": schema}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/api/neo4j/graph")
async def get_graph():
    """HTTP 接口：获取当前图谱状态"""
    try:
        data = get_neo4j_graph()
        return data
    except Exception as e:
        return {"nodes": [], "links": [], "error": str(e)}


@app.websocket("/ws/neo4j")
async def websocket_neo4j(websocket: WebSocket):
    """
    WebSocket 端点：实时推送 Neo4j 图谱更新
    支持增量更新和心跳检测
    """
    print(f"[WS] 尝试连接... Client={websocket.client}")
    await websocket.accept()
    conn_id = id(websocket)
    active_connections[conn_id] = Connection(websocket=websocket)
    print(f"[WS] Neo4j 客户端已连接 #{conn_id}. 当前连接数: {len(active_connections)}")
    
    # 发送初始完整数据
    try:
        initial_data = get_neo4j_graph()
        await websocket.send_json({
            "channel": "neo4j",
            "data": {
                "action": "full",
                "nodes": initial_data["nodes"],
                "links": initial_data["links"]
            }
        })
        print(f"[WS] 已发送初始数据: {len(initial_data['nodes'])} 节点, {len(initial_data['links'])} 关系")
        
        # 初始化该连接的状态
        conn = active_connections[conn_id]
        conn.last_state_hash = hashlib.md5(
            json.dumps(sorted(n["id"] for n in initial_data["nodes"])).encode()
        ).hexdigest()
        
    except Exception as e:
        print(f"[WS] 初始化失败: {e}")
        import traceback
        traceback.print_exc()
    
    try:
        while True:
            # 检查是否有客户端消息（心跳等）
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=2.5)
                msg_data = json.loads(message)
                
                # 响应心跳
                if msg_data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue
                    
            except asyncio.TimeoutError:
                pass  # 超时是正常的，继续推送数据
            
            # 获取最新图谱数据
            try:
                data = get_neo4j_graph()
                
                # 构建用于哈希的节点字典
                nodes_dict = {n["id"]: n for n in data["nodes"]}
                
                # 使用临时 GraphState 计算哈希
                temp_state = GraphState(nodes=nodes_dict, links=set(str(l) for l in data["links"]))
                current_hash = temp_state.compute_hash()
                
                conn = active_connections.get(conn_id)
                if conn and current_hash != conn.last_state_hash:
                    # 数据有变化，发送更新
                    await websocket.send_json({
                        "channel": "neo4j",
                        "data": {
                            "action": "update",
                            "nodes": data["nodes"],
                            "links": data["links"]
                        }
                    })
                    conn.last_state_hash = current_hash
                    # 只在节点数变化时打印详细日志，避免刷屏
                    print(f"[WS] 推送更新: {len(data['nodes'])} 节点, 速度/位置已变更")
                    
            except Exception as e:
                print(f"[WS] 获取数据失败: {e}")
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] 错误: {e}")
    finally:
        if conn_id in active_connections:
            del active_connections[conn_id]
        print(f"[WS] Neo4j 客户端已断开 #{conn_id}. 当前连接数: {len(active_connections)}")


@app.post("/api/neo4j/query")
async def execute_query(body: dict):
    """执行自定义 Cypher 查询"""
    cypher = body.get("cypher", "")
    if not cypher:
        return {"error": "Missing cypher query"}
    
    driver = get_driver()
    try:
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher)
            records = [dict(record) for record in result]
            return {"result": records}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    try:
        driver = get_driver()
        with driver.session(database=NEO4J_DATABASE) as session:
            session.run("RETURN 1")
        return {
            "status": "healthy",
            "neo4j": "connected",
            "uri": NEO4J_URI,
            "database": NEO4J_DATABASE,
            "connections": len(active_connections),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "neo4j": str(e),
            "uri": NEO4J_URI,
            "database": NEO4J_DATABASE,
            "connections": len(active_connections),
            "timestamp": datetime.now().isoformat()
        }


@app.get("/")
async def root():
    """根路径 - 显示 API 信息"""
    return {
        "service": "Neo4j WebSocket Bridge",
        "version": "2.0",
        "endpoints": {
            "GET /api/health": "健康检查",
            "GET /api/neo4j/schema": "探测数据库结构",
            "GET /api/neo4j/graph": "获取图谱数据",
            "POST /api/neo4j/query": "执行 Cypher 查询",
            "WS /ws/neo4j": "WebSocket 实时推送"
        },
        "config": {
            "neo4j_uri": NEO4J_URI,
            "database": NEO4J_DATABASE
        }
    }


@app.on_event("shutdown")
def shutdown_event():
    global driver
    if driver:
        driver.close()


if __name__ == "__main__":
    import uvicorn
    print(f"启动 Neo4j WebSocket Bridge...")
    print(f"Neo4j URI: {NEO4J_URI}")
    print(f"Database: {NEO4J_DATABASE}")
    # Port changed to 8002 to avoid conflict with DEIM (8000)
    uvicorn.run(app, host="127.0.0.1", port=8003)
