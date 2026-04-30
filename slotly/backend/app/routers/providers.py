from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models import ApprovalStatus, Provider, Role, Service, User
from ..schemas import ProviderIn, ProviderOut, ServiceOut
from ..security import get_current_user, require_role

router = APIRouter(prefix="/providers", tags=["providers"])


def _provider_for_user(session: Session, user: User) -> Provider:
    p = session.exec(select(Provider).where(Provider.user_id == user.id)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    return p


@router.post("/me", response_model=ProviderOut)
def upsert_my_profile(
    payload: ProviderIn,
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.provider)),
) -> ProviderOut:
    existing = session.exec(select(Provider).where(Provider.user_id == user.id)).first()
    if existing:
        for k, v in payload.model_dump().items():
            setattr(existing, k, v)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return ProviderOut.model_validate(existing, from_attributes=True)
    provider = Provider(user_id=user.id, **payload.model_dump())
    session.add(provider)
    session.commit()
    session.refresh(provider)
    return ProviderOut.model_validate(provider, from_attributes=True)


@router.get("/me", response_model=ProviderOut)
def get_my_profile(
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.provider)),
) -> ProviderOut:
    return ProviderOut.model_validate(_provider_for_user(session, user), from_attributes=True)


@router.get("/{provider_id}", response_model=ProviderOut)
def get_provider(provider_id: int, session: Session = Depends(get_session)) -> ProviderOut:
    p = session.get(Provider, provider_id)
    if not p or p.approval_status != ApprovalStatus.approved:
        raise HTTPException(status_code=404, detail="Provider not found")
    return ProviderOut.model_validate(p, from_attributes=True)


@router.get("/{provider_id}/services", response_model=list[ServiceOut])
def list_provider_services(provider_id: int, session: Session = Depends(get_session)) -> list[ServiceOut]:
    services = session.exec(
        select(Service).where(Service.provider_id == provider_id, Service.active == True)  # noqa: E712
    ).all()
    return [ServiceOut.model_validate(s, from_attributes=True) for s in services]
