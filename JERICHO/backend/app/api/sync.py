from fastapi import APIRouter

router = APIRouter()

@router.get("/pull")
async def pull_sync():
    """Pull latest data from server"""
    return {"message": "Pull sync endpoint - to be implemented"}

@router.post("/push")
async def push_sync():
    """Push local changes to server"""
    return {"message": "Push sync endpoint - to be implemented"}