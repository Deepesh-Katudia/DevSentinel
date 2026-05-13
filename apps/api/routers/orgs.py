from fastapi import APIRouter, Depends
from middleware.auth import verify_clerk_token, get_org_id

router = APIRouter()


@router.get("/me")
async def get_my_org(payload: dict = Depends(verify_clerk_token)):
    org_id = get_org_id(payload)
    return {"org_id": org_id}
