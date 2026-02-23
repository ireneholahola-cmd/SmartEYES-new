"""
交通流模拟器 (Traffic Simulator)
用于向 Neo4j 数据库生成实时交通数据，驱动前端数字孪生展示

运行方式: python traffic_simulator.py
"""

from neo4j import GraphDatabase
import os
import time
import random
import math
from datetime import datetime

# Neo4j 连接配置
NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "88888888")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

class TrafficSimulator:
    def __init__(self, uri, user, password, database):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        self.database = database
        self.vehicles = []
        self.road_segments = []

    def close(self):
        self.driver.close()

    def init_road_network(self):
        """初始化基础路网（如果为空）并加载拓扑结构"""
        print("正在检查路网数据...")
        with self.driver.session(database=self.database) as session:
            # 检查是否有路段
            result = session.run("MATCH (r:RoadSegment) RETURN count(r) as count")
            count = result.single()["count"]
            
            if count == 0:
                print("路网为空，正在生成基础数据...")
                # 创建交叉口
                session.run("""
                    CREATE (i1:Intersection {id: 'I-001', name: 'Main St & 1st Ave', x: 0, y: 0})
                    CREATE (i2:Intersection {id: 'I-002', name: 'Main St & 2nd Ave', x: 200, y: 0})
                    CREATE (i3:Intersection {id: 'I-003', name: 'Main St & 3rd Ave', x: 400, y: 0})
                    CREATE (i4:Intersection {id: 'I-004', name: 'Broadway & 1st Ave', x: 0, y: 200})
                    CREATE (i5:Intersection {id: 'I-005', name: 'Broadway & 2nd Ave', x: 200, y: 200})
                    
                    // 创建路段
                    CREATE (r1:RoadSegment {id: 'R-001', name: 'Main St West', length: 200})
                    CREATE (r2:RoadSegment {id: 'R-002', name: 'Main St East', length: 200})
                    CREATE (r3:RoadSegment {id: 'R-003', name: '1st Ave North', length: 200})
                    CREATE (r4:RoadSegment {id: 'R-004', name: '2nd Ave North', length: 200})
                    CREATE (r5:RoadSegment {id: 'R-005', name: 'Broadway West', length: 200})
                    
                    // 连接关系
                    CREATE (i1)-[:CONNECTED_TO]->(r1)-[:CONNECTED_TO]->(i2)
                    CREATE (i2)-[:CONNECTED_TO]->(r2)-[:CONNECTED_TO]->(i3)
                    CREATE (i1)-[:CONNECTED_TO]->(r3)-[:CONNECTED_TO]->(i4)
                    CREATE (i2)-[:CONNECTED_TO]->(r4)-[:CONNECTED_TO]->(i5)
                    CREATE (i4)-[:CONNECTED_TO]->(r5)-[:CONNECTED_TO]->(i5)
                """)
                print("基础路网创建完成")
            else:
                print(f"检测到 {count} 个路段，跳过初始化")
                
            # 加载路网拓扑: {road_id: [next_road_id, ...]}
            print("加载路网拓扑...")
            self.road_map = {}
            # 查找 (RoadSegment)-->(Intersection)-->(RoadSegment) 的连接
            # 简化链式查找： RoadSegment -> Intersection -> RoadSegment
            # 路段 r1 到路段 r2，中间通过一个交叉口
            result = session.run("""
                MATCH (r1:RoadSegment)-[:CONNECTED_TO]-(i:Intersection)-[:CONNECTED_TO]-(r2:RoadSegment)
                WHERE r1 <> r2
                RETURN r1.id as from, r2.id as to
            """)
            for record in result:
                if record["from"] not in self.road_map:
                    self.road_map[record["from"]] = []
                # 避免重复
                if record["to"] not in self.road_map[record["from"]]:
                    self.road_map[record["from"]].append(record["to"])
                
            # 加载所有路段ID列表
            result = session.run("MATCH (r:RoadSegment) RETURN r.id as id")
            self.road_segments = [record["id"] for record in result]
            print(f"路网加载完成，节点数: {len(self.road_segments)}")

    def spawn_vehicles(self, count=5):
        """生成新车辆"""
        if not self.road_segments:
            return

        with self.driver.session(database=self.database) as session:
            for _ in range(count):
                v_id = f"V-{int(time.time()*1000)%100000}-{random.randint(10,99)}"
                lane_id = f"L-{random.randint(1, 6)}"
                speed = random.randint(20, 80)
                road_id = random.choice(self.road_segments)
                
                vehicle = {
                    "id": v_id,
                    "speed": speed,
                    "lane_id": lane_id,
                    "current_road": road_id,
                    "progress": 0  # 0-100%
                }
                
                session.run("""
                    CREATE (v:Vehicle {id: $id, speed: $speed, type: 'Car', lane_id: $lane_id})
                    WITH v
                    MATCH (r:RoadSegment {id: $road_id})
                    CREATE (v)-[:LOCATED_IN]->(r)
                """, id=v_id, speed=speed, lane_id=lane_id, road_id=road_id)
                
                self.vehicles.append(vehicle)
                print(f"生成车辆: {v_id} -> {road_id}")

    def update_traffic(self):
        """更新车辆位置和速度"""
        if not self.vehicles:
            self.spawn_vehicles(10)
            
        # 随机移除一些车辆
        if random.random() < 0.05 and len(self.vehicles) > 5:
            removed = self.vehicles.pop(random.randint(0, len(self.vehicles)-1))
            with self.driver.session(database=self.database) as session:
                session.run("MATCH (v:Vehicle {id: $id}) DETACH DELETE v", id=removed["id"])
            print(f"车辆驶离: {removed['id']}")
            
        # 补充新车辆
        if len(self.vehicles) < 15:
            self.spawn_vehicles(random.randint(1, 2))
            
        with self.driver.session(database=self.database) as session:
            tx = session.begin_transaction()
            
            for v in self.vehicles:
                # 1. 更新速度
                v["speed"] = max(10, min(120, v["speed"] + random.randint(-10, 10)))
                v["progress"] += v["speed"] / 10 # 模拟前进
                
                # 2. 检查是否到达路段尽头 -> 移动到下一路段
                if v["progress"] >= 100:
                    v["progress"] = 0
                    current_road = v["current_road"]
                    
                    # 寻找下一个连接路段
                    next_roads = self.road_map.get(current_road, [])
                    if next_roads:
                        next_road = random.choice(next_roads)
                        v["current_road"] = next_road
                        
                        # 更新 Neo4j 关系: 删除旧关系，建立新关系
                        tx.run("""
                            MATCH (v:Vehicle {id: $id})
                            MATCH (v)-[old:LOCATED_IN]->(:RoadSegment)
                            DELETE old
                            WITH v
                            MATCH (new_r:RoadSegment {id: $new_road_id})
                            CREATE (v)-[:LOCATED_IN]->(new_r)
                        """, id=v["id"], new_road_id=next_road)
                        print(f"车辆移动: {v['id']} {current_road} -> {next_road}")
                    else:
                        # 此路不通，调头或者停留在原地 (这里简单重置到随机路段以保持流动)
                        next_road = random.choice(self.road_segments)
                        v["current_road"] = next_road
                         # 这里的逻辑稍微有点跳跃，但为了演示效果接受瞬移
                        tx.run("""
                            MATCH (v:Vehicle {id: $id})
                            MATCH (v)-[old:LOCATED_IN]->(:RoadSegment)
                            DELETE old
                            WITH v
                            MATCH (new_r:RoadSegment {id: $new_road_id})
                            CREATE (v)-[:LOCATED_IN]->(new_r)
                        """, id=v["id"], new_road_id=next_road)

                # 3. 更新常规属性
                if random.random() < 0.2:
                     v["lane_id"] = f"L-{random.randint(1, 6)}"
                
                tx.run("""
                    MATCH (v:Vehicle {id: $id})
                    SET v.speed = $speed, v.lane_id = $lane_id
                """, id=v["id"], speed=v["speed"], lane_id=v["lane_id"])
            
            tx.commit()

    def run(self):
        print(f"连接到 Neo4j: {NEO4J_URI} ({NEO4J_USER})")
        try:
            self.init_road_network()
            print("开始交通流模拟 (按 Ctrl+C 停止)...")
            
            while True:
                self.update_traffic()
                print(f"当前车辆数: {len(self.vehicles)} | 活跃连接: Neo4j")
                time.sleep(2.5) # 降低频率到 0.4Hz (2.5s)
                
        except KeyboardInterrupt:
            print("\n模拟停止")
        except Exception as e:
            print(f"发生错误: {e}")
        finally:
            self.close()

if __name__ == "__main__":
    sim = TrafficSimulator(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE)
    sim.run()
