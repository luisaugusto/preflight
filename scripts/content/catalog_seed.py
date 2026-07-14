"""Curated section/topic map for the four-handbook curriculum.

The checked-in catalog is generated from this map plus the pinned FAA PDF text.
Topic order follows the supplied handbook editions and is intentionally kept
separate from the runtime serializer so coverage can be audited directly.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceSpec:
    title: str
    short_title: str
    description: str
    edition: str
    url: str
    checksum: str
    page_count: int
    chapter_starts: dict[int, int]


@dataclass(frozen=True)
class SectionSpec:
    key: str
    chapter: int
    title: str
    start: int
    end: int
    topics: tuple[str, ...]
    acs_codes: tuple[str, ...]


def section(key, chapter, title, start, end, topics, acs_codes):
    return SectionSpec(key, chapter, title, start, end, tuple(topics), tuple(acs_codes))


PHAK = SourceSpec(
    title="Pilot's Handbook of Aeronautical Knowledge",
    short_title="PHAK",
    description="Aeronautical knowledge, systems, performance, weather, navigation, and pilot physiology.",
    edition="FAA-H-8083-25C (2023)",
    url="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/faa-h-8083-25c.pdf",
    checksum="247929cace0ab56b376e683eba540cc4c8f39f199ab35414e8b604e24f395cb7",
    page_count=522,
    chapter_starts={1: 16, 2: 40, 3: 72, 4: 88, 5: 98, 6: 149, 7: 161, 8: 203, 9: 231, 10: 245, 11: 257, 12: 285, 13: 311, 14: 335, 15: 376, 16: 388, 17: 423},
)

AFH = SourceSpec(
    title="Airplane Flying Handbook",
    short_title="AFH",
    description="Airplane flight training, maneuvers, takeoffs, landings, transitions, and emergencies.",
    edition="FAA-H-8083-3C (2021)",
    url="https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/00_afh_full.pdf",
    checksum="90dda95dcbe992bd798f1932b02b5a02d620d8344565c0516a6917f29dea1f8d",
    page_count=406,
    chapter_starts={1: 22, 2: 38, 3: 62, 4: 87, 5: 106, 6: 133, 7: 147, 8: 165, 9: 172, 10: 210, 11: 218, 12: 232, 13: 250, 14: 287, 15: 295, 16: 310, 17: 335, 18: 350},
)

AWH = SourceSpec(
    title="Aviation Weather Handbook",
    short_title="AWH",
    description="Weather theory, aviation hazards, observations, analysis, advisories, forecasts, and tools.",
    edition="FAA-H-8083-28B (2026)",
    url="https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf",
    checksum="2a87e4a5613e2a8e060aaf83a95dfc55b61b0e576f5b783df9fdcebe62da62c3",
    page_count=514,
    chapter_starts={1: 16, 2: 18, 3: 24, 4: 61, 5: 67, 6: 80, 7: 87, 8: 95, 9: 110, 10: 116, 11: 134, 12: 145, 13: 154, 14: 165, 15: 171, 16: 190, 17: 207, 18: 221, 19: 233, 20: 243, 21: 251, 22: 256, 23: 278, 24: 285, 25: 343, 26: 368, 27: 402, 28: 470},
)

RMH = SourceSpec(
    title="Risk Management Handbook",
    short_title="RMH",
    description="Practical hazard identification, risk assessment, mitigation, automation, and in-flight decision-making.",
    edition="FAA-H-8083-2A (2022)",
    url="https://www.faa.gov/sites/faa.gov/files/2022-06/risk_management_handbook_2A.pdf",
    checksum="519443a598eedd34c1824ad2ea482f393af0b80e52649e33c0e24a351e4c78bf",
    page_count=80,
    chapter_starts={1: 10, 2: 13, 3: 19, 4: 34, 5: 39, 6: 44, 7: 50, 8: 54},
)


PHAK_SECTIONS = [
    section("01", 1, "Introduction to Flying", 1, 24, ["FAA roles, regulations, and guidance", "Pilot certificates, ratings, and privileges", "Medical eligibility and fitness", "Flight training and instructor responsibilities", "Airman Certification Standards", "Choosing training resources and a flight school"], ["PA.I.A.K1", "PA.I.A.K2"]),
    section("02", 2, "Risk Foundations and Personal Minimums", 1, 14, ["Hazards, risk, and consequences", "PAVE preflight risk scan", "Personal minimums", "Risk assessment and mitigation"], ["PA.I.H.K1", "PA.I.H.R1", "PA.I.H.R2"]),
    section("02b", 2, "Decision Models and Single-Pilot Resources", 15, 32, ["Aeronautical decision-making cycle", "DECIDE and 3P models", "Hazardous attitudes and antidotes", "Single-pilot resource management", "Situational awareness, workload, and automation"], ["PA.I.H.K1", "PA.I.H.R1", "PA.I.H.R2"]),
    section("03", 3, "Aircraft Construction", 1, 16, ["Major airplane components", "Axes, motion, and center of gravity", "Truss, monocoque, and semimonocoque structures", "Wing, empennage, landing gear, and powerplant loads"], ["PA.I.G.K1", "PA.I.B.K1"]),
    section("04", 4, "Principles of Flight", 1, 10, ["Atmospheric properties and standard conditions", "Newton's laws and aerodynamic force", "Bernoulli, continuity, and pressure distribution", "Airfoil geometry, lift, drag, and vortices"], ["PA.I.F.K1", "PA.VII.B.K1"]),
    section("05", 5, "Forces, Vortices, and Airplane Motion", 1, 17, ["The four forces in equilibrium", "Lift and drag components", "Ground effect", "Wingtip vortices and wake avoidance", "Axes, moments, and coordinated motion"], ["PA.I.F.K1", "PA.VII.B.K1"]),
    section("05b", 5, "Stability, Maneuvering, and Stalls", 18, 34, ["Static and dynamic stability", "Longitudinal, lateral, and directional stability", "Turning forces and overbanking", "Critical angle of attack and stall recognition", "Spin awareness and recovery principles"], ["PA.I.F.K1", "PA.VII.A.K1"]),
    section("05c", 5, "Load Factors, Performance, and High-Speed Flight", 35, 51, ["Load factor in turns and turbulence", "Maneuvering speed and the V-g diagram", "Weight effects on performance and controllability", "Propeller effects and left-turning tendencies"], ["PA.I.F.K1", "PA.I.F.R1"]),
    section("06", 6, "Flight Controls", 1, 12, ["Primary flight controls", "Adverse yaw and coordinated control", "Flaps and high-lift devices", "Trim, spoilers, and secondary controls"], ["PA.I.G.K1", "PA.VII.A.K1"]),
    section("07", 7, "Piston Powerplants and Propellers", 1, 14, ["Four-stroke engine cycle", "Reciprocating engine components", "Induction, ignition, and cooling", "Mixture control and combustion hazards", "Fixed-pitch and constant-speed propellers"], ["PA.I.G.K1", "PA.I.G.K2"]),
    section("07b", 7, "Turbine Engines and Operating Limits", 15, 28, ["Turbojet, turbofan, turboprop, and turboshaft layouts", "Compression, combustion, and turbine sections", "Thrust, temperature, and rotational limits", "Turbine engine starts and abnormal indications"], ["PA.I.G.K1", "PA.I.G.K2"]),
    section("07c", 7, "Airframe and Supporting Systems", 29, 42, ["Fuel and electrical systems", "Hydraulic and pneumatic systems", "Landing gear and brakes", "Pressurization and oxygen", "Ice and rain protection"], ["PA.I.G.K1", "PA.I.G.K2"]),
    section("08", 8, "Flight Instruments", 1, 28, ["Pitot-static pressure sources", "Airspeed, altimeter, and vertical-speed indications", "Gyroscopic principles and instruments", "Magnetic compass errors", "Electronic flight displays", "Instrument failures and cross-check"], ["PA.I.G.K1", "PA.I.G.K2"]),
    section("09", 9, "Flight Manuals and Documents", 1, 14, ["Approved flight manual and operating handbook", "Required aircraft documents", "Airworthiness directives and inspections", "Maintenance records and inoperative equipment"], ["PA.I.B.K1", "PA.I.B.K2"]),
    section("10", 10, "Weight and Balance", 1, 12, ["Weight, balance, and center-of-gravity effects", "Datum, arm, moment, and index", "Loading computations", "Approved envelope and loading changes"], ["PA.I.F.K1", "PA.I.F.K2"]),
    section("11", 11, "Aircraft Performance", 1, 28, ["Performance factors and density altitude", "Takeoff and landing charts", "Climb performance and service ceiling", "Range, endurance, and fuel planning", "Wind, runway, and surface effects", "Interpolation and conservative chart use"], ["PA.I.F.K1", "PA.I.F.K2", "PA.I.F.K3"]),
    section("12", 12, "Weather Theory", 1, 26, ["Atmospheric pressure, temperature, and moisture", "Wind and global circulation", "Stability, lapse rates, and clouds", "Air masses and fronts", "Thunderstorms and turbulence", "Icing and visibility hazards"], ["PA.I.C.K1", "PA.I.C.K2", "PA.I.C.R1"]),
    section("13", 13, "Aviation Weather Services", 1, 24, ["Preflight briefing responsibilities", "Surface observations and METAR", "Terminal forecasts and winds aloft", "AIRMET, SIGMET, and convective advisories", "Radar and satellite limitations", "Inflight weather updates and decision-making"], ["PA.I.C.K2", "PA.I.C.K3", "PA.I.C.R2"]),
    section("14", 14, "Airport Data, Markings, Signs, and Lighting", 1, 13, ["Airport publications and diagrams", "Runway and taxiway markings", "Airport signs and holding positions", "Lighting, beacons, and visual approach indicators"], ["PA.III.A.K1", "PA.III.B.K1"]),
    section("14b", 14, "Traffic Patterns, Communications, and Wake", 14, 26, ["Standard traffic pattern geometry", "Towered and nontowered communication", "Right-of-way and collision avoidance", "Wake turbulence recognition and avoidance"], ["PA.III.A.K1", "PA.III.B.K1"]),
    section("14c", 14, "Runway Safety and Surface Risk", 27, 40, ["Runway incursion prevention", "Hot spots and runway confusion", "Taxi clearances and progressive instructions", "Land-and-hold-short operations", "Engineered material arresting systems"], ["PA.III.A.K1", "PA.III.C.K1"]),
    section("15", 15, "Airspace", 1, 12, ["Controlled and uncontrolled airspace", "Entry, equipment, and communication rules", "VFR weather minimums", "Special-use and other airspace"], ["PA.I.E.K1", "PA.I.E.K2", "PA.I.E.R1"]),
    section("16", 16, "Charts, Direction, Time, and Wind", 1, 12, ["Sectional chart information and currency", "Latitude, longitude, and direction", "True, magnetic, and compass courses", "Time, distance, speed, and fuel calculations"], ["PA.VI.A.K1", "PA.VI.A.K2"]),
    section("16b", 16, "Pilotage, Dead Reckoning, and Flight Planning", 13, 24, ["Pilotage and checkpoint selection", "Dead-reckoning workflow", "Wind triangle and groundspeed", "Navigation log, altitude, and fuel planning"], ["PA.VI.A.K1", "PA.VI.A.K2"]),
    section("16c", 16, "Radio and Satellite Navigation", 25, 35, ["VOR orientation and intercepts", "DME and station passage", "ADF and relative bearing", "GPS integrity and database limitations", "Lost procedures and diversion"], ["PA.VI.A.K1", "PA.VI.A.K2"]),
    section("17", 17, "Aeromedical Factors", 1, 30, ["Hypoxia types and oxygen use", "Pressure-change and trapped-gas effects", "Spatial disorientation", "Vision and night operations", "Stress, fatigue, and dehydration", "Alcohol, medication, and carbon monoxide"], ["PA.I.H.K2", "PA.I.H.K3", "PA.I.H.R3"]),
]


AFH_SECTIONS = [
    section("01", 1, "Introduction to Flight Training", 1, 16, ["Training objectives and airmanship", "FAA regulations and certification framework", "Flight instructor and learner responsibilities", "Positive exchange of flight controls", "Flight deck management and collision avoidance"], ["PA.I.A.K1", "PA.I.H.R1"]),
    section("02", 2, "Ground Operations", 1, 24, ["Preflight visual inspection", "Cockpit checks and passenger briefing", "Engine starting and hand propping hazards", "Taxiing and brake checks", "Wind correction during taxi", "Before-takeoff checks and runway awareness"], ["PA.III.A.K1", "PA.I.G.K1"]),
    section("03", 3, "Basic Flight Maneuvers", 1, 25, ["Attitude flying and integrated controls", "Straight-and-level flight", "Level turns and coordination", "Climbs and climbing turns", "Descents and descending turns", "Slow flight and minimum controllable airspeed"], ["PA.VII.A.K1", "PA.VII.B.K1"]),
    section("04", 4, "Energy Management", 1, 19, ["Kinetic and potential energy", "Power, pitch, and flightpath", "Energy state awareness", "Managing energy errors", "Scenario-based altitude and airspeed control"], ["PA.I.F.K1", "PA.VII.A.K1"]),
    section("05", 5, "Upset Prevention and Recovery", 1, 27, ["Loss-of-control risk and prevention", "Aerodynamic factors in an upset", "Stall recognition and recovery", "Spin awareness", "Unusual attitude recognition", "Airplane upset recovery priorities"], ["PA.VII.A.K1", "PA.VII.B.K1"]),
    section("06", 6, "Takeoffs and Departure Climbs", 1, 14, ["Takeoff planning and performance", "Normal and crosswind takeoffs", "Short-field and obstacle takeoffs", "Soft-field takeoffs and rejected takeoffs"], ["PA.III.A.K1", "PA.I.F.K2"]),
    section("07", 7, "Ground Reference Maneuvers", 1, 18, ["Wind drift and ground track", "Rectangular course", "S-turns across a road", "Turns around a point", "Eights on pylons and pivotal altitude"], ["PA.VII.A.K1", "PA.I.F.K1"]),
    section("08", 8, "Airport Traffic Patterns", 1, 7, ["Pattern entries, legs, and departures", "Wind correction and spacing", "Collision avoidance and communications"], ["PA.III.A.K1", "PA.III.B.K1"]),
    section("09", 9, "Normal Approaches and Landings", 1, 20, ["Stabilized approach concept", "Normal approach and roundout", "Crosswind approach and touchdown", "Go-around decision and execution", "Forward slips and side slips"], ["PA.III.B.K1", "PA.III.C.K1"]),
    section("09b", 9, "Specialized and Emergency Landings", 21, 38, ["Short-field approach and landing", "Soft-field approach and landing", "Power-off accuracy approach", "Faulty approaches and bounced landings", "Emergency approaches and off-airport landing"], ["PA.III.B.K1", "PA.IX.C.K1"]),
    section("10", 10, "Performance Maneuvers", 1, 8, ["Steep turns and load management", "Steep spirals and chandelles", "Lazy eights and maneuver coordination"], ["PA.VII.A.K1", "PA.I.F.K1"]),
    section("11", 11, "Night Operations", 1, 14, ["Night vision and visual illusions", "Night preflight and lighting", "Night takeoff, navigation, and landing", "Night emergencies and inadvertent IMC"], ["PA.I.H.K2", "PA.III.A.K1"]),
    section("12", 12, "Transition to Complex Airplanes", 1, 18, ["Complex-airplane systems", "Retractable landing gear", "Constant-speed propeller", "Flaps, trim, and operating technique", "Gear and propeller malfunctions"], ["PA.I.G.K1", "PA.I.G.K2"]),
    section("13", 13, "Multiengine Systems and Normal Operations", 1, 18, ["Multiengine aerodynamics", "Systems and performance", "Critical engine and VMC", "Normal takeoff and climb", "Approach, landing, and go-around"], ["PA.I.G.K1", "PA.I.F.K2"]),
    section("13b", 13, "Engine-Inoperative Operations", 19, 37, ["Engine-failure recognition and control", "Drag reduction and configuration", "Identify, verify, feather", "Restart and securing procedures", "Single-engine approach and landing", "Engine failure after liftoff and decision-making"], ["PA.IX.C.K1", "PA.I.H.R1"]),
    section("14", 14, "Transition to Tailwheel Airplanes", 1, 8, ["Tailwheel stability and directional control", "Ground operations and takeoff", "Wheel landings, three-point landings, and go-arounds"], ["PA.III.A.K1", "PA.III.B.K1"]),
    section("15", 15, "Transition to Turboprop Airplanes", 1, 15, ["Turboprop engine arrangements", "Power, propeller, and condition controls", "Operating limits and indications", "Takeoff, climb, and cruise", "Approach, landing, and emergencies"], ["PA.I.G.K1", "PA.I.F.K2"]),
    section("16", 16, "Transition to Jet Airplanes", 1, 25, ["Jet engine principles", "High-speed aerodynamics", "Jet systems and limitations", "Performance and energy management", "Jet takeoff and climb", "Approach, landing, and rejected takeoff"], ["PA.I.G.K1", "PA.I.F.K2"]),
    section("17", 17, "Transition to Light-Sport Airplanes", 1, 15, ["Light-sport categories and limitations", "Control response and low inertia", "Weight-shift-control aircraft", "Powered parachutes", "Gyroplanes and transition discipline"], ["PA.I.B.K1", "PA.VII.A.K1"]),
    section("18", 18, "Emergency Procedures", 1, 23, ["Emergency priorities and checklists", "Engine failure and restart", "Fire, smoke, and electrical emergencies", "Flight-control and system malfunctions", "Forced landing planning and execution", "Post-crash survival and reporting"], ["PA.IX.C.K1", "PA.I.H.R1"]),
]


AWH_SECTIONS = [
    section("01", 1, "Introduction", 1, 2, ["Purpose and organization of aviation weather information", "Pilot responsibility for weather knowledge and decisions"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("02", 2, "Aviation Weather Service Program", 1, 6, ["FAA and National Weather Service roles", "Aviation weather service providers", "Weather information dissemination and pilot reports"], ["PA.I.C.K2", "PA.I.C.R1"]),
    section("03", 3, "Weather Information Use and Briefings", 1, 8, ["Preflight action and briefing responsibility", "Official weather sources", "Standard, abbreviated, and outlook briefings"], ["PA.I.C.K2", "PA.I.C.R2"]),
    section("03b", 3, "Weather Product Landscape", 9, 37, ["Observations and pilot reports", "Analyses and weather depiction", "Advisories and warnings", "Forecast product families", "Aviation weather tools", "Selecting products by weather element"], ["PA.I.C.K2", "PA.I.C.K3"]),
    section("04", 4, "The Earth's Atmosphere", 1, 6, ["Atmospheric composition and air parcels", "Troposphere, stratosphere, and standard atmosphere", "Pressure, density, and temperature with altitude"], ["PA.I.C.K1", "PA.I.F.K1"]),
    section("05", 5, "Heat and Temperature", 1, 13, ["Temperature measurement and scales", "Heat transfer", "Daily and seasonal temperature variation", "Temperature effects on aircraft performance"], ["PA.I.C.K1", "PA.I.F.K1"]),
    section("06", 6, "Water Vapor", 1, 7, ["Hydrologic cycle and phase changes", "Humidity, saturation, and dewpoint", "Latent heat and aviation weather"], ["PA.I.C.K1", "PA.I.C.K3"]),
    section("07", 7, "Earth-Atmosphere Heat Imbalances", 1, 8, ["Unequal solar heating", "Radiation budget and greenhouse effects", "Seasonal and geographic energy transport"], ["PA.I.C.K1", "PA.I.C.K3"]),
    section("08", 8, "Atmospheric Pressure and Altimetry", 1, 15, ["Pressure measurement and station pressure", "Sea-level pressure and pressure systems", "Pressure altitude and density altitude", "Altimeter settings and errors", "Pressure tendency and operational interpretation"], ["PA.I.C.K1", "PA.I.F.K1"]),
    section("09", 9, "Global Circulations and Jet Streams", 1, 6, ["Global pressure belts and circulation cells", "Coriolis force and prevailing winds", "Jet streams and flight planning"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("10", 10, "Wind", 1, 18, ["Pressure-gradient, Coriolis, and friction forces", "Geostrophic and gradient wind", "Local sea, lake, valley, and mountain breezes", "Wind shear, gusts, and sudden shifts", "Crosswind components and operational effects"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("11", 11, "Air Masses, Fronts, and Wave Cyclones", 1, 11, ["Air-mass source regions and modification", "Warm, cold, stationary, and occluded fronts", "Wave cyclone development", "Frontal weather and flight hazards"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("12", 12, "Vertical Motion and Clouds", 1, 9, ["Convection, convergence, orographic, and frontal lift", "Adiabatic cooling and cloud formation", "Cloud forms and height families", "Operational meaning of cloud structure"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("13", 13, "Atmospheric Stability", 1, 11, ["Parcel method and lapse rates", "Stable and unstable air", "Temperature inversions", "Stability indices and aviation impacts"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("14", 14, "Precipitation", 1, 6, ["Precipitation growth processes", "Rain, snow, sleet, and freezing rain", "Precipitation intensity and flight visibility"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("15", 15, "Weather Radar", 1, 19, ["Radar principles and reflectivity", "NEXRAD products and mosaics", "Airborne radar operation", "Attenuation, shadows, and limitations", "Safe tactical and strategic radar use"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("16", 16, "Mountain Weather", 1, 17, ["Mountain waves and rotor clouds", "Orographic clouds and precipitation", "Downslope winds and turbulence", "Mountain obscuration and density altitude", "Route, altitude, and escape planning"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("17", 17, "Tropical Weather", 1, 14, ["Tropical circulation and convergence", "Tropical waves and cyclones", "Hurricane structure and hazards", "Tropical flight planning and advisories"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("18", 18, "Weather and Obstructions to Visibility", 1, 12, ["Radiation, advection, upslope, and steam fog", "Haze, smoke, dust, and blowing snow", "Precipitation restrictions", "Visibility reporting and operational risk"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("19", 19, "Turbulence", 1, 10, ["Convective and mechanical turbulence", "Clear-air turbulence", "Low-level wind shear", "Mountain-wave and wake turbulence"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("20", 20, "Icing", 1, 8, ["Structural icing formation and types", "Induction and instrument icing", "Icing forecasts, reports, and avoidance"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("21", 21, "Arctic Weather", 1, 5, ["Arctic climate and air masses", "Ice fog, blowing snow, and whiteout", "Cold-weather altimetry and operations"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("22", 22, "Thunderstorms", 1, 22, ["Thunderstorm ingredients and life cycle", "Air-mass and severe thunderstorms", "Lightning, hail, and tornadoes", "Downbursts and microbursts", "Convective turbulence and icing", "Detection, avoidance, and escape margins"], ["PA.I.C.K1", "PA.I.C.R1"]),
    section("23", 23, "Space Weather", 1, 7, ["Solar activity and geomagnetic storms", "Radiation and ionospheric effects", "Communication, navigation, and polar-route impacts"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("24", 24, "Surface Observations and METAR/SPECI", 1, 20, ["Observation systems and quality control", "METAR/SPECI format", "Wind, visibility, and runway visual range", "Weather, sky condition, and ceiling", "Temperature, altimeter, and remarks"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("24b", 24, "Aircraft and Radar Observations", 21, 40, ["Pilot weather reports", "Automated aircraft reports", "Weather radar observations", "Lightning detection", "Observation latency and limitations"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("24c", 24, "Satellite and Upper-Air Observations", 41, 58, ["Visible, infrared, and water-vapor imagery", "Soundings and upper-air observations", "Weather cameras", "Buoy, ship, and remote observations", "Combining observations into situational awareness"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("25", 25, "Analysis", 1, 25, ["Surface analysis charts", "Upper-air analysis", "Radar and satellite analysis", "Fronts, pressure systems, and isobars", "Ceiling and visibility analysis", "Using analysis without treating it as a forecast"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("26", 26, "SIGMET, AIRMET, and CWA", 1, 17, ["Advisory purpose and issuance", "SIGMET criteria", "Convective SIGMET", "AIRMET and G-AIRMET", "Center Weather Advisory"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("26b", 26, "Specialized and Local Advisories", 18, 34, ["Volcanic ash advisories", "Tropical cyclone advisories", "Space-weather advisories", "Low-level wind-shear alerts", "Local warnings and airport weather alerts"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("27", 27, "Winds, TAF, and Surface Forecasts", 1, 17, ["Forecast process and uncertainty", "Terminal Aerodrome Forecast format", "Winds and temperatures aloft", "Ceiling and visibility forecasts", "Surface and local forecasts"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("27b", 27, "Regional, Global, and Significant-Weather Forecasts", 18, 34, ["Graphical Forecasts for Aviation", "Area and route forecasts", "Significant weather charts", "International and global products", "Tropical forecast products"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("27c", 27, "Prognostic and Hazard Guidance", 35, 48, ["Surface prognostic charts", "Upper-air forecasts", "Icing guidance", "Turbulence guidance"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("27d", 27, "Convective and Specialized Forecasts", 49, 68, ["Convective outlooks", "Thunderstorm probability and timing", "Winter-weather forecasts", "Aviation-specific local forecasts", "Forecast limitations and updates"], ["PA.I.C.K3", "PA.I.C.R2"]),
    section("28", 28, "Aviation Weather Tools", 1, 3, ["Graphical Forecasts for Aviation tool", "Layering weather tools into a complete briefing"], ["PA.I.C.K3", "PA.I.C.R2"]),
]


RMH_SECTIONS = [
    section("01", 1, "Introduction to Risk Management", 1, 3, ["Hazards, risk, likelihood, and severity", "Risk management as a continuous safety process"], ["PA.I.H.K1", "PA.I.H.R1"]),
    section("02", 2, "Personal Minimums", 1, 6, ["Legal minimums versus personal margins", "Building a personal-minimums checklist", "Reviewing limits as proficiency and conditions change"], ["PA.I.H.K1", "PA.I.H.R1"]),
    section("03", 3, "Identifying Hazards and Risks", 1, 15, ["Systematic hazard identification", "PAVE and the 5P check", "Pilot and aircraft hazards", "Environment hazards", "External pressure and interacting risks"], ["PA.I.H.K1", "PA.I.H.R1", "PA.I.H.R2"]),
    section("04", 4, "Assessing Risk", 1, 5, ["Likelihood and severity", "Risk matrices and acceptability", "Cumulative and residual risk"], ["PA.I.H.K1", "PA.I.H.R1"]),
    section("05", 5, "Mitigating Risk", 1, 5, ["Avoid, reduce, transfer, and accept", "Controls for pilot, aircraft, and environment", "Validating controls and monitoring residual risk"], ["PA.I.H.K1", "PA.I.H.R1"]),
    section("06", 6, "Threat and Error Management", 1, 5, ["Threats, errors, and undesired aircraft states", "Traps and error chains", "Defenses, recovery, and learning"], ["PA.I.H.K1", "PA.I.H.R2"]),
    section("07", 7, "Automation and Flight Path Management", 1, 4, ["Automation levels and appropriate use", "Mode awareness and input verification", "Flightpath monitoring and manual-flight readiness"], ["PA.I.H.K1", "PA.I.H.R2"]),
    section("08", 8, "Aeronautical Decision-Making in Flight", 1, 4, ["Continuous inflight risk reassessment", "Time-critical decisions and changing plans", "Continuation bias, diversion, and landing options"], ["PA.I.H.K1", "PA.I.H.R1", "PA.I.H.R2"]),
]


MODULE_SPECS = {
    "phak": (PHAK, PHAK_SECTIONS),
    "afh": (AFH, AFH_SECTIONS),
    "awh": (AWH, AWH_SECTIONS),
    "rmh": (RMH, RMH_SECTIONS),
}
