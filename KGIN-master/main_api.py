import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any, Optional
import torch
import numpy as np
import os
import sys
import argparse
from collections import defaultdict

# Add current directory to path
sys.path.append(os.getcwd())

from modules.KGIN import Recommender
import utils.data_loader as dl

app = FastAPI(title="Traffic SmartEYES KGIN API", description="KGIN Traffic Recommendation Service")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
model = None
args = None
device = None
graph = None
mean_mat_list = []
n_params = {}
cached_embeddings = None

class RecommendationRequest(BaseModel):
    user_id: int # Represents traffic condition ID (Head)
    k: int = 10  # Top-K suggestions

class LaneData(BaseModel):
    id: str
    traffic: float
    speed: float
    queue: float
    occupancy: float
    status: str

class StatsData(BaseModel):
    globalDensity: float
    efficiency: float
    load: float
    latency: float
    timestamp: str

class TrafficRecommendationRequest(BaseModel):
    lanes: List[LaneData]
    stats: Any

class Args:
    """Configuration class to mimic argparse"""
    def __init__(self):
        self.dataset = os.getenv("KGIN_DATASET", "alibaba-fashion")
        self.data_path = "KGIN-master/data/"
        self.epoch = 1000
        self.batch_size = 1024
        self.test_batch_size = 1024
        self.dim = 64
        self.l2 = 1e-5
        self.lr = 1e-4
        self.sim_regularity = 1e-4
        self.inverse_r = True
        self.node_dropout = True
        self.node_dropout_rate = 0.5
        self.mess_dropout = True
        self.mess_dropout_rate = 0.1
        self.batch_test_flag = True
        self.channel = 64
        self.cuda = torch.cuda.is_available() # Auto-detect CUDA
        self.gpu_id = 0
        self.Ks = '[20, 40, 60, 80, 100]'
        self.test_flag = 'part'
        self.n_factors = 4
        self.ind = 'distance'
        self.context_hops = 3
        self.save = False
        self.out_dir = "./weights/"

def read_cf(file_name):
    """Read Collaborative Filtering data (User-Item interactions)"""
    inter_mat = list()
    lines = open(file_name, "r").readlines()
    for l in lines:
        tmps = l.strip()
        inters = [int(i) for i in tmps.split(" ")]
        u_id, pos_ids = inters[0], inters[1:]
        pos_ids = list(set(pos_ids))
        for i_id in pos_ids:
            inter_mat.append([u_id, i_id])
    return np.array(inter_mat)

def load_data_api(model_args):
    """Custom data loader for API"""
    global n_params
    directory = model_args.data_path + model_args.dataset + '/'
    
    print(f"Reading train and test user-item set from {directory} ...")
    train_file = directory + 'train.txt'
    test_file = directory + 'test.txt'
    
    if not os.path.exists(train_file):
        raise FileNotFoundError(f"Train file not found: {train_file}")

    train_cf = read_cf(train_file)
    test_cf = read_cf(test_file)
    
    # Update globals in utils.data_loader because subsequent functions depend on them
    dl.n_users = max(max(train_cf[:, 0]), max(test_cf[:, 0])) + 1
    dl.n_items = max(max(train_cf[:, 1]), max(test_cf[:, 1])) + 1
    
    # Update train_user_set and test_user_set in dl
    for u_id, i_id in train_cf:
        dl.train_user_set[int(u_id)].append(int(i_id))
    for u_id, i_id in test_cf:
        dl.test_user_set[int(u_id)].append(int(i_id))

    print('Combinating train_cf and kg data ...')
    dl.args = model_args # Fix: Inject args into data_loader module
    triplets = dl.read_triplets(directory + 'kg_final.txt')

    print('Building the graph ...')
    graph, relation_dict = dl.build_graph(train_cf, triplets)

    print('Building the adj mat ...')
    adj_mat_list, norm_mat_list, mean_mat_list = dl.build_sparse_relational_graph(relation_dict)

    n_params = {
        'n_users': int(dl.n_users),
        'n_items': int(dl.n_items),
        'n_entities': int(dl.n_entities),
        'n_nodes': int(dl.n_nodes),
        'n_relations': int(dl.n_relations)
    }
    
    return train_cf, test_cf, n_params, graph, [adj_mat_list, norm_mat_list, mean_mat_list]

@app.on_event("startup")
async def startup_event():
    global model, args, device, graph, mean_mat_list, n_params, cached_embeddings
    
    args = Args()
    device = torch.device("cuda:"+str(args.gpu_id)) if args.cuda and torch.cuda.is_available() else torch.device("cpu")
    print(f"Device: {device}")

    try:
        _, _, n_params, graph, mat_list = load_data_api(args)
        _, _, mean_mat_list = mat_list
        
        # Initialize Model
        model = Recommender(n_params, args, graph, mean_mat_list[0]).to(device)
        
        # Load Weights
        weight_path = args.out_dir + 'model_' + args.dataset + '.ckpt'
        if os.path.exists(weight_path):
            print(f"Loading weights from {weight_path}")
            model.load_state_dict(torch.load(weight_path, map_location=device))
        else:
            print(f"Warning: Weights file {weight_path} not found. Using random initialization.")
            
        model.eval()
        
        # Pre-compute embeddings (Optional: remove if graph changes dynamically)
        print("Pre-computing embeddings...")
        with torch.no_grad():
             entity_gcn_emb, user_gcn_emb = model.generate()
             cached_embeddings = (entity_gcn_emb, user_gcn_emb)
        print("Model ready.")
        
    except Exception as e:
        print(f"Startup failed: {e}")
        import traceback
        traceback.print_exc()
        # raise e # Uncomment to crash if data fails

@app.post("/predict")
async def predict(request: RecommendationRequest):
    """
    Legacy Endpoint: Get traffic suggestions (items) for a given traffic condition (user).
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
        
    user_id = request.user_id
    k = request.k
    
    if user_id >= n_params['n_users']:
        raise HTTPException(status_code=404, detail=f"User ID {user_id} not found. Max ID: {n_params['n_users']-1}")

    try:
        with torch.no_grad():
            # Use cached embeddings if available, else generate
            if cached_embeddings:
                entity_gcn_emb, user_gcn_emb = cached_embeddings
            else:
                entity_gcn_emb, user_gcn_emb = model.generate()
            
            u_e = user_gcn_emb[user_id].unsqueeze(0) # [1, channel]
            
            # Score all items
            item_indices = torch.arange(n_params['n_items']).to(device)
            i_e = entity_gcn_emb[item_indices] # [n_items, channel]
            
            scores = model.rating(u_e, i_e).squeeze(0) # [n_items]
            
            # Top K
            top_k_scores, top_k_indices = torch.topk(scores, k)
            
            recommendations = top_k_indices.cpu().numpy().tolist()
            scores_list = top_k_scores.cpu().numpy().tolist()
            
            return {
                "input_traffic_id": user_id,
                "recommended_routes": recommendations,
                "scores": scores_list,
                "explanation": "High congestion detected in related nodes. Recommendation based on KGIN relational path optimization."
            }
            
    except Exception as e:
        print(f"Error during inference: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recommend")
async def recommend(data: TrafficRecommendationRequest):
    """
    Standard Integration Endpoint: Receives real-time traffic data and returns KGIN suggestions.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    # 1. Map Traffic Data to KGIN User ID
    # Simple logic: Map the most congested lane to a User ID
    # In production, this should be a sophisticated mapping or embedding lookup
    congested_lane = None
    max_occupancy = -1
    
    for lane in data.lanes:
        if lane.occupancy > max_occupancy:
            max_occupancy = lane.occupancy
            congested_lane = lane
            
    # Mock mapping: Hash lane ID to available User ID range
    # Ensure user_id is within [0, n_users)
    if congested_lane:
        user_id = hash(congested_lane.id) % n_params['n_users']
        target_lane_id = congested_lane.id
    else:
        user_id = 0
        target_lane_id = "Global"

    try:
        # 2. Run KGIN Inference
        with torch.no_grad():
            if cached_embeddings:
                entity_gcn_emb, user_gcn_emb = cached_embeddings
            else:
                entity_gcn_emb, user_gcn_emb = model.generate()
            
            u_e = user_gcn_emb[user_id].unsqueeze(0)
            item_indices = torch.arange(n_params['n_items']).to(device)
            i_e = entity_gcn_emb[item_indices]
            scores = model.rating(u_e, i_e).squeeze(0)
            
            # Get Top 3 suggestions
            top_k = 3
            _, top_k_indices = torch.topk(scores, top_k)
            recommendations_ids = top_k_indices.cpu().numpy().tolist()

        # 3. Format Response
        # Map Item IDs back to meaningful text (Mock implementation)
        # In production, use item_list.txt or a database
        
        response = {
            "summary": f"KGIN 分析完成。检测到 {target_lane_id} 负载较高 (占用率 {max_occupancy}%)，已生成优化策略。",
            "recommendations": [
                f"建议对 {target_lane_id} 上游路段实施分流 (策略ID: {recommendations_ids[0]})",
                f"建议调整下游红绿灯配时 (策略ID: {recommendations_ids[1]})",
                f"建议开启 {target_lane_id} 对应的可变限速标志 (策略ID: {recommendations_ids[2]})"
            ],
            "optimizedParams": []
        }
        
        # Generate optimized params for each lane
        for lane in data.lanes:
            # Simple optimization logic based on status
            is_congested = lane.status in ["critical", "delay"]
            opt_rate = 0.15 if is_congested else 0.05
            
            response["optimizedParams"].append({
                "laneId": lane.id,
                "suggestedTraffic": int(lane.traffic * (0.9 if is_congested else 1.05)),
                "suggestedSpeed": int(lane.speed * (1.1 if is_congested else 1.0)),
                "expectedQueue": 0.0,
                "optimizationRate": opt_rate
            })
            
        return response

    except Exception as e:
        print(f"Error during recommendation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8005)
