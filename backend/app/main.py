from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.api.routes import router as api_router
from app.db.session import create_db_and_tables
from app.workers.scheduler import schedule_jobs


app = FastAPI(title="Midas API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).resolve().parents[2]
frontend_dist = ROOT / "frontend" / "dist"
templates = Jinja2Templates(directory=str(ROOT / "backend" / "templates"))

app.include_router(api_router)


@app.on_event("startup")
def startup() -> None:
    create_db_and_tables()
    schedule_jobs()


if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")


@app.get("/", response_class=HTMLResponse)
def index():
    index_file = frontend_dist / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return HTMLResponse("<h1>Midas backend is running. Build frontend to view dashboard.</h1>")


@app.get("/opt-out/{lead_id}", response_class=HTMLResponse)
def opt_out_page(request: Request, lead_id: int):
    return templates.TemplateResponse("opt_out.html", {"request": request, "lead_id": lead_id})
