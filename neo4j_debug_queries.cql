// 1. 检查是否有数据（节点总数）
MATCH (n) RETURN count(n) as TotalNodes;

// 2. 检查是否有车辆数据（模拟器是否生效）
MATCH (n:Vehicle) RETURN n LIMIT 10;

// 3. 检查路段数量（模拟器应该创建 5 个路段，如果只有 1 个说明数据可能有问题）
MATCH (n:RoadSegment) RETURN count(n);

// 4.如果你想清空数据库重新开始（慎用！）
// MATCH (n) DETACH DELETE n;
