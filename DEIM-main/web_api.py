"""
DEIM FastAPI Web Service
交通智慧眼系统后端服务入口

提供以下端点：
  POST /upload           上传视频，立即返回 task_id
  GET  /task/{task_id}  查询推理进度和结果
  静态文件 /results/     托管结果视频和 JSON

依赖安装（deim conda 环境下）：
  pip install fastapi uvicorn[standard] python-multipart ffmpeg-python
  conda install -c conda-forge ffmpeg
"""

import os
import sys
import gc
import json
import uuid
import logging
import threading
import subprocess
from functools import lru_cache
from pydantic import BaseModel
from typing import Dict, Any, Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import httpx

# Load environment variables from server/.env
load_dotenv(Path(__file__).resolve().parent.parent / "server/.env")

# KGIN Service Configuration
KGIN_API_URL = os.getenv("KGIN_SERVICE_URL", "http://localhost:8001/recommend")

# ─── 日志配置 ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("web_api")

# 将项目根目录加入 sys.path
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from deim_inference import DEIMInferenceEngine

# Supabase Client Setup
try:
    from supabase import create_client, Client
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"Supabase connected: {SUPABASE_URL}")
    else:
        supabase = None
        logger.warning("Supabase URL or Key not found in environment")
except ImportError:
    supabase = None
    logger.warning("Supabase library not found. Run `pip install supabase`")
except Exception as e:
    supabase = None
    logger.error(f"Supabase init error: {e}")

# ─── 路径配置 ─────────────────────────────────────────────────────────────────
# A. 确保路径绝对准确
BASE_DIR = "P:/GitHub_project/DEIM-main/DEIM-main"
# 如果环境不同，可以回退到相对路径，但在此环境中明确指定
if not os.path.exists(BASE_DIR):
    BASE_DIR = str(_ROOT)

CONFIG_PATH  = os.path.join(BASE_DIR, "configs", "deim_dfine", "deim_hgnetv2_n_coco.yml")
WEIGHT_PATH  = os.path.join(BASE_DIR, "weights", "deim_dfine_s.pth")
UPLOAD_DIR   = Path(BASE_DIR) / "data" / "uploads"
RESULTS_DIR  = Path(BASE_DIR) / "data" / "results"
BASE_URL     = "http://localhost:8000"  # 前端访问的后端地址

# 自动创建目录
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# ─── 全局状态 ─────────────────────────────────────────────────────────────────
engine = DEIMInferenceEngine()

# 任务状态字典（生产建议替换为 Redis）
# task_id -> {"status": str, "progress": int, "result_url": str, "result_json": dict, "error": str}
tasks: Dict[str, Dict[str, Any]] = {}
tasks_lock = threading.Lock()

# ─── FastAPI 应用 ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="交通智慧眼 DEIM API",
    description="DEIM 目标检测推理服务，提供视频上传与异步推理功能",
    version="1.0.0",
)

# CORS 配置（允许前端 React 开发服务器访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite 开发服务器
        "http://localhost:3000",   # 备用（CRA / Next.js）
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",   # 显式放行 3000 端口
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# B. 挂载静态目录（确保前端能通过 URL 访问视频）
app.mount("/results", StaticFiles(directory=str(RESULTS_DIR)), name="results")


# ─── 生命周期事件（模型单例加载）────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """服务启动时加载模型（只执行一次）"""
    logger.info("=" * 60)
    logger.info("交通智慧眼 DEIM 服务启动中...")
    logger.info(f"  配置文件: {CONFIG_PATH}")
    logger.info(f"  权重文件: {WEIGHT_PATH}")
    logger.info("=" * 60)

    if not os.path.exists(CONFIG_PATH):
        logger.error(f"配置文件不存在: {CONFIG_PATH}")
        raise RuntimeError(f"配置文件不存在: {CONFIG_PATH}")
    if not os.path.exists(WEIGHT_PATH):
        logger.error(f"权重文件不存在: {WEIGHT_PATH}")
        raise RuntimeError(f"权重文件不存在: {WEIGHT_PATH}")

    try:
        engine.load_model(CONFIG_PATH, WEIGHT_PATH)
        logger.info("✓ 模型加载成功，服务就绪！")
    except Exception as e:
        logger.error(f"✗ 模型加载失败: {e}")
        raise


# ─── 后台推理任务 ─────────────────────────────────────────────────────────────
def _run_inference_task(task_id: str, input_path: str) -> None:
    logger.info(f"[{task_id[:8]}] MOCK _run_inference_task for {input_path}. Doing nothing.")
    with tasks_lock:
        tasks[task_id].update({
            "status": "done",
            "progress": 100,
            "result_url": "mock_url",
            "result_json": {},
            "error": None,
        })
    logger.info(f"[{task_id[:8]}] MOCK _run_inference_task finished.")


# ─── API 端点 ─────────────────────────────────────────────────────────────────

@app.get("/", summary="健康检查")
async def health_check():
    """服务健康检查，返回模型加载状态"""
    return {
        "service": "交通智慧眼 DEIM API",
        "status": "running",
        "model_loaded": engine.is_loaded,
    }


@app.post("/upload", summary="上传视频并启动推理")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="待检测的视频文件（MP4 / AVI / MOV）"),
):
    """
    接收视频文件，立即返回 task_id，后台异步执行 DEIM 推理。

    - 请求：multipart/form-data，字段名 `file`
    - 响应：{"task_id": "uuid", "status": "processing"}
    """
    if not engine.is_loaded:
        raise HTTPException(status_code=503, detail="模型尚未加载完成，请稍后重试")

    # 验证文件类型
    filename = file.filename or "video.mp4"
    ext = os.path.splitext(filename)[-1].lower()
    if ext not in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {ext}")

    # 生成唯一任务 ID，重命名文件防止冲突
    task_id = str(uuid.uuid4())
    save_path = str(UPLOAD_DIR / f"{task_id}{ext}")

    # 保存上传文件
    try:
        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)
        logger.info(f"[{task_id[:8]}] 文件已保存: {save_path} ({len(content) / 1024:.1f} KB)")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件保存失败: {str(e)}")

    # 初始化任务状态
    with tasks_lock:
        tasks[task_id] = {
            "status": "processing",
            "progress": 0,
            "result_url": None,
            "result_json": None,
            "error": None,
        }

    # 用 BackgroundTasks 在后台线程运行推理（不阻塞当前请求）
    background_tasks.add_task(_run_inference_task, task_id, save_path)

    return JSONResponse(
        status_code=202,  # 202 Accepted：请求已接受，处理中
        content={
            "task_id": task_id,
            "status": "processing",
            "message": "视频已上传，推理任务已启动，请通过 /tasks/{task_id} 轮询进度",
        },
    )


@app.get("/tasks/{task_id}", summary="查询推理任务状态")
async def get_task_status(task_id: str):
    """
    轮询任务处理进度。前端每隔 3~5 秒调用一次。

    状态说明：
    - processing：推理进行中
    - transcoding：正在转码为 H.264
    - done：处理完成，result_url 可用
    - failed：处理失败，error 字段包含错误信息
    """
    with tasks_lock:
        task = tasks.get(task_id)

    if task is None:
        # 为了兼容前端逻辑，返回 JSON 错误而不是直接抛出 404 异常
        # 这有助于前端优雅地处理“未找到任务”的情况
        return {"error": "Task not found", "status": "not_found"}

    response = {
        "task_id": task_id,
        "status": task["status"],
        "progress": task["progress"],
    }

    if task["status"] == "done":
        response["result_url"] = task["result_url"]
        response["result_json"] = task["result_json"]

    if task["status"] == "failed":
        response["error"] = task["error"]

    return response


@app.get("/tasks", summary="查询所有任务（调试用）")
async def list_tasks():
    """返回所有任务的简要状态（调试用，生产可删除）"""
    with tasks_lock:
        return {
            tid: {
                "status": info["status"],
                "progress": info["progress"],
            }
            for tid, info in tasks.items()
        }


# ─── KGIN Integration ────────────────────────────────────────────────────────
class KGINRequest(BaseModel):
    lanes: list
    stats: dict

@app.post("/kgin/inference", summary="触发 KGIN 诱导推演")
async def kgin_inference(data: KGINRequest):
    """
    接收前端发来的实时交通统计，调用 KGIN 服务生成诱导策略。
    如果 KGIN 服务不可用，则返回 Mock 策略以保证演示流畅。
    """
    # 1. Try calling real KGIN Service
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(KGIN_API_URL, json=data.dict())
            if resp.status_code == 200:
                logger.info("KGIN Service Hit!")
                return resp.json()
    except Exception as e:
        logger.warning(f"KGIN Service unavailable ({e}), falling back to heuristic mock.")

    # 2. Heuristic Mock (Fallback)
    # 简单的基于规则的 Mock
    mock_response = {
        "summary": "本地启发式分析：检测到车流波动，已生成应急预案。",
        "recommendations": [],
        "optimizedParams": []
    }
    
    # 简单的规则逻辑
    for lane in data.lanes:
        if lane.get('occupancy', 0) > 60:
             mock_response["recommendations"].append(f"建议对 {lane.get('id')} 实施分流")
             mock_response["optimizedParams"].append({
                 "laneId": lane.get('id'),
                 "suggestedTraffic": int(lane.get('traffic', 0) * 0.8),
                 "suggestedSpeed": 60,
                 "expectedQueue": 0,
                 "optimizationRate": 0.2
             })
    
    if not mock_response["recommendations"]:
        mock_response["summary"] = "当前交通状况良好，保持现有控制策略。"
        
    return mock_response


# ─── 启动入口 ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "web_api:app",
        host="0.0.0.0",
        port=8004,
        reload=False,  # 生产模式关闭 reload，避免模型重复加载
        log_level="info",
    )
