
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


# Project directories
BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent

# Load the existing project .env file
load_dotenv(PROJECT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")


class Settings(BaseSettings):
    APP_NAME: str = "MARSWALK API"
    API_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"

    # Gemini configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"

    # Raster paths
    DATA_DIR: Path = BACKEND_DIR / "data"
    DEM_PATH: Path = DATA_DIR / "processed" / "jezero_dem_mars_projected.tif"
    ORTHO_PATH: Path = DATA_DIR / "processed" / "jezero_ortho_mars_projected.tif"

    # Rover configuration (simulation assumptions)
    DEFAULT_BATTERY_WH: float = 7200.0
    DEFAULT_RESERVE_PERCENT: float = 20.0
    DEFAULT_SPEED_MPS: float = 0.05
    DEFAULT_ENERGY_WH_PER_M: float = 1.0
    DEFAULT_CLIMB_WH_PER_M: float = 2.0

    # Routing configuration
    DEFAULT_MAX_SLOPE_DEG: float = 25.0
    DEFAULT_SLOPE_WEIGHT: float = 2.0
    DEFAULT_UPHILL_WEIGHT: float = 1.0

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Ensure the data directory exists
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
