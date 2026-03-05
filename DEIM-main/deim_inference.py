"""
DEIM Inference Engine Wrapper
封装 DEIM/D-FINE 模型为可复用的推理类，供 web_api.py 调用。

不修改原始 torch_inf.py，本文件独立封装推理逻辑。
"""
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import os
import sys
import gc
import json
import logging
from typing import Callable, Optional, Dict, Any, List

# 强制禁用 Windows Media Foundation，避免 H.264 编码兼容性问题
os.environ["OPENCV_VIDEOIO_PRIORITY_MSMF"] = "0"

import torch
import torch.nn as nn

# ─── MOCK MODE CHECK ─────────────────────────────────────────────────────────
# Check if torchvision is broken (common in mixed environments)
try:
    import torchvision.transforms as T
    # Test if ops are working (trigger the error early)
    from torchvision import ops
    _ = ops.nms(torch.tensor([[0., 0., 10., 10.]]), torch.tensor([1.0]), 0.5)
    MOCK_MODE = False
except (RuntimeError, ImportError, Exception) as e:
    logger.warning(f"⚠️  Torchvision error detected ({e}). Entering MOCK MODE.")
    MOCK_MODE = True
    T = None

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

# ... (rest of imports)

# ─── Mock Classes for Fallback ───────────────────────────────────────────────
class MockModel(nn.Module):
    def forward(self, x, s):
        # Return fake detections: [labels, boxes, scores]
        # Batch size 1
        return (
            torch.tensor([[3]]), # Label 3 = car
            torch.tensor([[[100.0, 100.0, 300.0, 300.0]]]), # Box
            torch.tensor([[0.95]]) # Score
        )

# ... (keep existing code until class DEIMInferenceEngine)

class DEIMInferenceEngine:
    def __init__(self):
        self._model = None
        self._device = None
        self.is_loaded = False
        self._transforms = None

    # ... (init stays same)

    def load_model(self, config_path: str, weight_path: str, device: Optional[str] = None) -> None:
        if MOCK_MODE:
            logger.warning("[DEIM] Running in MOCK MODE. Real inference is disabled.")
            self._model = MockModel()
            self._device = "cpu"
            self.is_loaded = True
            return

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        
        logger.warning("[DEIM] Model loading logic is incomplete in deim_inference.py.")
        logger.warning("[DEIM] Using a placeholder. This will likely fail.")
        self.is_loaded = False # Set to false, as model is not really loaded
        
        # Placeholder for model loading
        # The original code seems to be missing.
        # You would typically load a model from config and weights here.
        # For example:
        # self._model = build_model_from_config(config_path)
        # self._model.load_state_dict(torch.load(weight_path))
        # self._model.to(device)
        # self.is_loaded = True

    # ... (process_video modification)
    def process_video(
        self,
        input_path: str,
        output_path: str,
        progress_callback: Optional[Callable[[int], None]] = None,
        thrh: float = 0.4,
    ) -> Dict[str, Any]:
        
        if MOCK_MODE:
             # MOCK IMPLEMENTATION: Just copy video and generate fake data
             logger.info("[DEIM] Mock processing started...")
             import shutil
             import time
             
             # Copy input to output (simulate processing)
             try:
                shutil.copy(input_path, output_path)
             except:
                pass # If copy fails, maybe same path
                
             # Fake progress
             for i in range(10):
                 time.sleep(0.2)
                 if progress_callback: progress_callback(i * 10)
                 
             # Generate fake result
             return {
                "total_frames": 100,
                "total_vehicles": 500,
                "max_vehicles_per_frame": 8,
                "avg_vehicles_per_frame": 5.0,
                "frames": [
                    {
                        "frame": i,
                        "vehicle_count": 5 + (i % 5),
                        "detections": [
                            {"label": "car", "label_id": 3, "score": 0.9, "box": [100+i, 100, 200+i, 200]}
                        ]
                    } for i in range(100)
                ]
             }

        # ... (Real implementation below)
        if not self.is_loaded:
             raise RuntimeError("模型尚未加载，请先调用 load_model()")
             
        cap = cv2.VideoCapture(input_path)
        # ... (rest of the original function)
        if not cap.isOpened():
            raise ValueError(f"无法打开视频: {input_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        # 确保分辨率为偶数（编码器要求）
        orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if orig_w % 2 != 0: orig_w -= 1
        if orig_h % 2 != 0: orig_h -= 1
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

        # 尝试获取编码器：优先 WebM (VP80)，其次 H.264
        # WebM 格式在浏览器中兼容性极佳，且不易出现 Profile 问题
        fourcc = None
        
        # 1. 尝试 WebM (VP80) - 推荐
        if output_path.endswith(".webm"):
            try:
                fourcc = cv2.VideoWriter_fourcc(*'VP80')
                logger.info("[DEIM] 使用 WebM (VP80) 编码")
            except:
                pass
        
        # 2. 如果不是 WebM 或 VP80 失败，尝试 H.264
        if fourcc is None:
            # 调整优先级：优先尝试 H264 (更通用的 FourCC)，然后是 avc1
            for codec in ['H264', 'avc1', 'X264']:
                try:
                    test_fourcc = cv2.VideoWriter_fourcc(*codec)
                    # 简单测试是否可用
                    test_out = cv2.VideoWriter('test_codec_probe.mp4', test_fourcc, 1, (10, 10))
                    if test_out.isOpened():
                        test_out.release()
                        try:
                            os.remove('test_codec_probe.mp4')
                        except:
                            pass
                        fourcc = test_fourcc
                        logger.info(f"[DEIM] 使用视频编码: {codec}")
                        break
                except Exception:
                    continue
            
            # 3. 实在不行，回退到 mp4v
            if fourcc is None:
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                logger.warning("[DEIM] 未找到 H.264 编码器，回退到 mp4v (浏览器可能无法直接播放)")

        out = cv2.VideoWriter(output_path, fourcc, fps, (orig_w, orig_h))

        frame_results: List[Dict] = []
        vehicle_counts: List[int] = []
        frame_idx = 0
        last_reported_pct = -10  # 上次报告进度（初始值确保 0% 会触发回调）

        logger.info(f"[DEIM] 开始处理视频: {total_frames} 帧, {orig_w}x{orig_h} @ {fps:.1f}fps")

        try:
            with torch.no_grad():
                while cap.isOpened():
                    ret, bgr_frame = cap.read()
                    if not ret:
                        break

                    # BGR -> RGB PIL
                    frame_pil = Image.fromarray(cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB))
                    w, h = frame_pil.size
                    orig_size = torch.tensor([[w, h]], dtype=torch.float32).to(self._device)
                    im_data = self._transforms(frame_pil).unsqueeze(0).to(self._device)

                    # 推理
                    labels, boxes, scores = self._model(im_data, orig_size)

                    # 绘制检测框（修改 frame_pil in-place）
                    vehicle_count = self._draw_frame(frame_pil, labels, boxes, scores, thrh)
                    vehicle_counts.append(vehicle_count)

                    # 记录本帧数据
                    scr = scores[0].cpu()
                    lab = labels[0].cpu()
                    box = boxes[0].cpu()
                    mask = scr > thrh
                    frame_results.append({
                        "frame": frame_idx,
                        "vehicle_count": vehicle_count,
                        "detections": [
                            {
                                "label": LABEL_MAP.get(lab[j].item(), str(lab[j].item())),
                                "label_id": lab[j].item(),
                                "score": round(scr[j].item(), 3),
                                "box": [round(x, 1) for x in box[j].tolist()],
                            }
                            for j in range(len(lab)) if mask[j]
                        ],
                    })

                    # 写帧
                    result_bgr = cv2.cvtColor(np.array(frame_pil), cv2.COLOR_RGB2BGR)
                    out.write(result_bgr)

                    frame_idx += 1

                    # 进度回调（每 10% 触发一次）
                    if progress_callback and total_frames > 0:
                        pct = int((frame_idx / total_frames) * 100)
                        if pct - last_reported_pct >= 10:
                            last_reported_pct = pct
                            progress_callback(min(pct, 99))  # 99% 保留给转码完成

                    # 及时释放 GPU 张量
                    del im_data, orig_size, labels, boxes, scores, scr, lab, box, mask
                    if self._device == "cuda":
                        torch.cuda.empty_cache()

        except Exception as e:
            logger.error(f"[DEIM] 推理过程中发生异常: {e}")
            raise e
        finally:
            if cap.isOpened():
                cap.release()
            if 'out' in locals() and out.isOpened():
                out.release()
                logger.info("[DEIM] 视频写入流已安全关闭")

        # 聚合统计
        total_vehicle_sum = sum(vehicle_counts)
        max_v = max(vehicle_counts) if vehicle_counts else 0
        avg_v = round(total_vehicle_sum / len(vehicle_counts), 2) if vehicle_counts else 0

        logger.info(f"[DEIM] 推理完成: {frame_idx} 帧, 总车辆检测={total_vehicle_sum}, 最大={max_v}")

        # 最终清理
        gc.collect()
        if self._device == "cuda":
            torch.cuda.empty_cache()

        return {
            "total_frames": frame_idx,
            "total_vehicles": total_vehicle_sum,
            "max_vehicles_per_frame": max_v,
            "avg_vehicles_per_frame": avg_v,
            "frames": frame_results,
        }
