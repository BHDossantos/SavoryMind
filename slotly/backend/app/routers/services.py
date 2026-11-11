from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models import ApprovalStatus, Provider, Role, Service, User
from ..schemas import ServiceIn, ServiceOut
from ..security import require_role

router = APIRouter(prefix="/services", tags=["services"])


def _my_provider(session: Session, user: User) -> Provider:
    p = session.exec(select(Provider).where(Provider.user_id == user.id)).first()
    if not p:
        raise HTTPException(status_code=400, detail="Create your provider profile first")
    return p


@router.get("/mine", response_model=list[ServiceOut])
def list_my_services(
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.provider)),
) -> list[ServiceOut]:
    p = _my_provider(session, user)
    services = session.exec(select(Service).where(Service.provider_id == p.id)).all()
    return [ServiceOut.model_validate(s, from_attributes=True) for s in services]


@router.post("", response_model=ServiceOut)
def create_service(
    payload: ServiceIn,
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.provider)),
) -> ServiceOut:
    p = _my_provider(session, user)
    s = Service(provider_id=p.id, **payload.model_dump())
    session.add(s)
    session.commit()
    session.refresh(s)
    return ServiceOut.model_validate(s, from_attributes=True)


@router.put("/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: int,
    payload: ServiceIn,
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.provider)),
) -> ServiceOut:
    p = _my_provider(session, user)
    s = session.get(Service, service_id)
    if not s or s.provider_id != p.id:
        raise HTTPException(status_code=404, detail="Service not found")
    for k, v in payload.model_dump().items():
        setattr(s, k, v)
    session.add(s)
    session.commit()
    session.refresh(s)
    return ServiceOut.model_validate(s, from_attributes=True)


@router.delete("/{service_id}", status_code=204)
def delete_service(
    service_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.provider)),
) -> None:
    p = _my_provider(session, user)
    s = session.get(Service, service_id)
    if not s or s.provider_id != p.id:
        raise HTTPException(status_code=404, detail="Service not found")
    s.active = False
    session.add(s)
    session.commit()


@router.get("/{service_id}", response_model=ServiceOut)
def get_public_service(service_id: int, session: Session = Depends(get_session)) -> ServiceOut:
    service = session.get(Service, service_id)
    provider = session.get(Provider, service.provider_id) if service else None
    if not service or not service.active or not provider or provider.approval_status != ApprovalStatus.approved:
        raise HTTPException(status_code=404, detail="Service not found")
    return ServiceOut.model_validate(service, from_attributes=True)
