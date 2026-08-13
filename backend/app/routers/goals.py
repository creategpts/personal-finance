from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import goals_logic, models, schemas
from ..database import get_db
from ..kpi_logic import category_name_sets

router = APIRouter(prefix="/api/goals", tags=["goals"])


def _get(db: Session, goal_id: int) -> models.Goal:
    goal = db.get(models.Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.get("", response_model=list[schemas.GoalOut])
def list_goals(db: Session = Depends(get_db)):
    return db.query(models.Goal).order_by(models.Goal.id).all()


@router.post("", response_model=schemas.GoalOut)
def create_goal(payload: schemas.GoalCreate, db: Session = Depends(get_db)):
    if payload.type not in goals_logic.GOAL_TYPES:
        raise HTTPException(status_code=422, detail="Invalid goal type")
    t = payload.target
    goal = models.Goal(
        name=payload.name,
        account=payload.account,
        type=payload.type,
        active=payload.active,
        start_year=payload.start_year,
        start_month=payload.start_month,
    )
    goal.targets.append(
        models.GoalTarget(
            eff_year=t.eff_year or payload.start_year,
            eff_month=t.eff_month or payload.start_month,
            amount=t.amount,
            percent=t.percent,
            target_amount=t.target_amount,
            target_year=t.target_year,
            target_month=t.target_month,
        )
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/{goal_id}", response_model=schemas.GoalOut)
def update_goal(goal_id: int, payload: schemas.GoalUpdate, db: Session = Depends(get_db)):
    goal = _get(db, goal_id)
    goal.name = payload.name
    goal.active = payload.active
    db.commit()
    db.refresh(goal)
    return goal


@router.post("/{goal_id}/targets", response_model=schemas.GoalOut)
def add_target(goal_id: int, payload: schemas.GoalTargetIn, db: Session = Depends(get_db)):
    """Add an effect-dated target change. Does NOT rewrite past months.
    Replaces (not stacks) any existing target for the same effective month."""
    goal = _get(db, goal_id)
    today = date.today()
    ey = payload.eff_year or today.year
    em = payload.eff_month or today.month
    existing = next((t for t in goal.targets if t.eff_year == ey and t.eff_month == em), None)
    target = existing or models.GoalTarget(goal_id=goal.id, eff_year=ey, eff_month=em)
    target.amount = payload.amount
    target.percent = payload.percent
    target.target_amount = payload.target_amount
    target.target_year = payload.target_year
    target.target_month = payload.target_month
    if existing is None:
        goal.targets.append(target)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = _get(db, goal_id)
    db.delete(goal)  # cascade deletes its targets
    db.commit()


@router.get("/{goal_id}/progress", response_model=schemas.GoalProgress)
def progress(goal_id: int, db: Session = Depends(get_db)):
    goal = _get(db, goal_id)
    done = (
        db.query(models.Movement)
        .filter(models.Movement.status == models.MovementStatus.done)
        .all()
    )
    names = category_name_sets(db)

    # balance in the tracked account entering the goal's start month (initial balance +
    # net of Done movements before it). Seeds target_date goals so existing money counts.
    acct = db.query(models.Category).filter(models.Category.name == goal.account).first()
    start_balance = acct.initial_balance if acct else 0.0
    start_balance += sum(
        (m.amount if m.destination == goal.account else -m.amount)
        for m in done
        if (m.origin == goal.account or m.destination == goal.account)
        and (m.year, m.month) < (goal.start_year, goal.start_month)
    )

    return goals_logic.goal_progress(goal, done, names, date.today(), start_balance)
