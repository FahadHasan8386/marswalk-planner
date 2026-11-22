
import os

from dotenv import load_dotenv
from google import genai

from app.schemas.pydantic_models import (
    GeminiExplanationRequest,
    GeminiExplanationResponse,
)

load_dotenv()


class GeminiAnalysisService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv(
            "GEMINI_MODEL",
            "gemini-flash-latest"
        )

        self.client = None

        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as error:
                print(
                    f"Gemini client initialization failed: {error}"
                )

    def is_available(self) -> bool:
        return self.client is not None

    def generate_explanation(
        self,
        request: GeminiExplanationRequest,
        energy_analysis: dict | None = None
    ) -> GeminiExplanationResponse:

        metrics = request.route_metrics

        if self.client is None:
            return GeminiExplanationResponse(
                explanation=(
                    "Gemini AI is currently unavailable because the "
                    "GEMINI_API_KEY is missing or the client could not "
                    "be initialized. Python route calculations and "
                    "energy analysis remain available."
                )
            )

        # Format Python energy-engine results.
        energy_text = (
            "No separate energy simulation results were provided."
        )

        if energy_analysis:
            rt = energy_analysis.get("round_trip", {})
            checks = energy_analysis.get("checks", {})

            energy_text = f"""
- Python recommendation: {energy_analysis.get('recommendation', 'UNKNOWN')}
- Python recommendation reason: {energy_analysis.get('recommendation_reason', 'N/A')}
- Round-trip distance: {rt.get('total_distance_m', 'Not provided')} metres
- Round-trip energy: {rt.get('total_energy_wh', 'Not provided')} Wh
- Remaining battery: {rt.get('remaining_battery_wh', 'Not provided')} Wh
- Remaining battery percentage: {rt.get('remaining_battery_percent', 'Not provided')}%
- Usable energy budget: {rt.get('usable_energy_wh', 'Not provided')} Wh
- Required reserve energy: {rt.get('reserve_energy_wh', 'Not provided')} Wh
- Required reserve percentage: {checks.get('required_reserve_percent', 'Not provided')}%
- Battery sufficient: {checks.get('battery_sufficient', 'Not provided')}
- Slope constraints satisfied: {checks.get('slope_sufficient', 'Not provided')}
- Slope violation count: {checks.get('slope_violation_count', 'Not provided')}
"""

        prompt = f"""
You are the AI terrain and rover mission analysis assistant
for MARSWALK, a Mars rover mission planning prototype.

Your role is to EXPLAIN calculated results produced by the
Python mission-planning and energy-analysis backend.

You are NOT the mission decision engine.

==================================================
ROUTE INFORMATION
==================================================

Route preference:
{request.route_mode}

==================================================
TERRAIN AND MISSION SUMMARY
==================================================

{request.terrain_summary or "No additional terrain summary was provided."}

==================================================
PROVIDED ROUTE METRICS
==================================================

These metrics describe the route data supplied by the application.
Do not assume that unavailable measurements are zero.

Outbound distance:
{metrics.distance_m:.2f} metres

Mean slope:
{metrics.mean_slope_deg:.2f} degrees

Maximum slope:
{metrics.max_slope_deg:.2f} degrees

Total ascent:
{metrics.ascent_m:.2f} metres

Total descent:
{metrics.descent_m:.2f} metres

Estimated outbound energy:
{metrics.estimated_energy_wh:.2f} Wh

Estimated OUTBOUND travel time:
{metrics.estimated_travel_time_seconds / 3600:.2f} hours

Steep segments:
{metrics.steep_segments}

Total segments/nodes:
{metrics.total_segments}

IMPORTANT:
The travel time above is explicitly the OUTBOUND travel time.
Do not describe it as round-trip travel time.
Do not calculate or invent a return travel time unless the
application explicitly supplies the required return metrics.

==================================================
PYTHON ENERGY ENGINE RESULTS
==================================================

{energy_text}

==================================================
YOUR ANALYSIS TASKS
==================================================

1. Explain the Python backend's GO or NO-GO recommendation.
   If no recommendation is provided, explicitly say that the
   mission decision was not supplied.

2. Explain battery consumption and reserve availability using
   only the supplied energy-engine results.

3. Explain the terrain using the supplied slope, distance,
   ascent, descent, and segment measurements.

4. Explain practical route-planning considerations based on
   the actual supplied measurements.

5. If multiple route candidates are supplied, compare only
   the candidates and metrics explicitly provided.

==================================================
STRICT RULES
==================================================

- Python is the only authority for GO/NO-GO decisions.
- Never independently change the Python recommendation.
- Never claim that a NO-GO mission is safe.
- Never claim that a GO recommendation guarantees real-world safety.
- Never invent terrain measurements, distances, energy values,
  travel times, route candidates, or battery percentages.
- Never confuse outbound measurements with round-trip measurements.
- Never claim that unavailable measurements are zero.
- Never claim that the route is officially NASA-approved.
- Never describe prototype estimates as official NASA rover data.
- Do not claim that the model is scientifically validated.
- Clearly distinguish calculated measurements from interpretation.
- If data is missing, state that it was not provided.
- Do not make unsupported recommendations about scientific
  operations or landing-site safety.

==================================================
RESPONSE FORMAT
==================================================

Write a professional explanation suitable for a science
competition demonstration.

Use these sections:

### Mission Assessment
Explain the Python recommendation and its reason.

### Route and Terrain Analysis
Explain the available route and terrain measurements.

### Energy and Battery Assessment
Explain energy usage and reserve information.

### Planning Recommendations
Give practical recommendations supported by the supplied data.

Keep the response approximately 150-250 words.
Use readable Markdown formatting.
"""

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )

            explanation = (response.text or "").strip()

            if not explanation:
                explanation = (
                    "Gemini returned an empty response. "
                    "The Python mission calculations remain available."
                )

            return GeminiExplanationResponse(
                explanation=explanation
            )

        except Exception as error:
            print(f"Gemini analysis error: {error}")

            return GeminiExplanationResponse(
                explanation=(
                    "The route analysis and energy simulation were "
                    "completed, but Gemini could not generate an "
                    "explanation at this time. Please check the "
                    "Gemini API key and internet connection."
                )
            )


_gemini_service = None


def get_gemini_analysis_service():
    global _gemini_service

    if _gemini_service is None:
        _gemini_service = GeminiAnalysisService()

    return _gemini_service
