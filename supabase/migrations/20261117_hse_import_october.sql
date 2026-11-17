-- EGS — HSE import October 2026
-- Evan's October 2026 HSE Excel: 23 observations, 1 false fire alarm, the month's numbers and summary.
-- Safe to run once. It stops if HSE already has observations.

begin;

do $$ begin if exists (select 1 from public.hse_observations) then raise exception 'hse_observations already has rows — import not needed'; end if; end $$;

insert into public.hse_observations (num, building, location, observation, priority, required_action, responsible, status, found_on, target_on, remarks, created_by, updated_by) values
  (1, $q$C5$q$, $q$Third-floor door$q$, $q$Broken glass above the door; high risk, especially in the coming rainy and windy season.$q$, $q$High$q$, $q$Secure the area and replace the glass.$q$, $q$Maintenance / Facade$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P6 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (2, $q$C1$q$, $q$Smoking area$q$, $q$Broken/damaged glass above the smoking area; risk of falling glass and injury to people below.$q$, $q$High$q$, $q$Secure the area and replace the glass.$q$, $q$Maintenance / Facade$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P1 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (3, $q$C2$q$, $q$Between C1 and C2, second floor$q$, $q$Broken glass requires urgent replacement.$q$, $q$High$q$, $q$Replace the glass urgently.$q$, $q$Maintenance / Facade$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P4 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (4, $q$C3$q$, $q$Green Emerald$q$, $q$Broken glass creating a potential falling-glass hazard.$q$, $q$High$q$, $q$Secure the area and replace the glass.$q$, $q$Maintenance / Facade$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P5 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (5, $q$C1$q$, $q$Zone A parking$q$, $q$Damaged glass at the corner opposite Zone A parking.$q$, $q$Medium$q$, $q$Replace the glass.$q$, $q$Maintenance / Facade$q$, 'open', date '2026-09-30', date '2026-09-30' + 14, $q$Photo ref. P2 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (6, $q$C2$q$, $q$TEC area$q$, $q$Damaged glass.$q$, $q$Medium$q$, $q$Repair or replace the glass.$q$, $q$Maintenance / Facade$q$, 'open', date '2026-09-30', date '2026-09-30' + 14, $q$Photo ref. P3 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (7, $q$C1–C6$q$, $q$Electrical panels$q$, $q$Panels are rusty and some panel doors are damaged.$q$, $q$High$q$, $q$Repair or replace the affected panels and ensure they can be safely secured.$q$, $q$Electrical Maintenance$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P8 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (8, $q$C6$q$, $q$Roof – Electrical cable$q$, $q$A 4 × 16 mm² cable is wrapped with tape; high electrical risk.$q$, $q$High$q$, $q$Proper insulation and protection; inspection by qualified electrical personnel.$q$, $q$Electrical Maintenance$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P9 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (9, $q$Roofs$q$, $q$Rooftop water tanks$q$, $q$Some tanks overflow during filling; float valves may need adjustment or replacement.$q$, $q$High$q$, $q$Inspect the float valves and adjust or replace them.$q$, $q$MEP / Plumbing$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P7 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (10, $q$C1–C6$q$, $q$First-aid kits$q$, $q$Requested previously but not yet provided.$q$, $q$High$q$, $q$Provide suitable, accessible kits for all six buildings and verify contents.$q$, $q$Procurement / HSE$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$No photo in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (11, $q$C3$q$, $q$Emergency staircase$q$, $q$Outdoor split AC units/components located above the emergency staircase.$q$, $q$High$q$, $q$Remove and relocate them; keep the staircase clear and accessible.$q$, $q$MEP / HVAC$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P10 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (12, $q$C4$q$, $q$VIP basement$q$, $q$Fire hose cabinet positioned within a vehicle parking space, affecting access and emergency use.$q$, $q$High$q$, $q$Relocate to a suitable, visible and accessible location.$q$, $q$Fire Fighting / MEP$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P11 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (13, $q$C3$q$, $q$Near C3 – Assembly Point sign$q$, $q$Sign damaged; vinyl sticker peeling and partially covering the text; pole rusted.$q$, $q$Medium$q$, $q$Repair or replace the sign.$q$, $q$Maintenance / HSE$q$, 'open', date '2026-09-30', date '2026-09-30' + 14, $q$Photo ref. P14 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (14, $q$C4–C6$q$, $q$Assembly Point signs$q$, $q$Signs required or need to be verified in these areas.$q$, $q$Medium$q$, $q$Install or verify Emergency Assembly Point signs.$q$, $q$HSE / Maintenance$q$, 'open', date '2026-09-30', date '2026-09-30' + 14, $q$Photo ref. P15 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (15, $q$C1–C3$q$, $q$Anti-slip strips$q$, $q$Strips on tiled pedestrian paths in front of the entrances are worn.$q$, $q$Medium$q$, $q$Replace the worn strips, particularly before the rainy weather.$q$, $q$Maintenance / Civil$q$, 'open', date '2026-09-30', date '2026-09-30' + 14, $q$Photo ref. P13 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (16, $q$Zone B$q$, $q$Slots 41 & 57$q$, $q$Request from last month to remove the two slots and reopen the area as a vehicle exit route has not been completed.$q$, $q$High$q$, $q$Follow up on removal and reopening of the exit route, subject to site approval.$q$, $q$Civil / Parking Mgmt$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$Photo ref. P15 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (17, $q$Zone C$q$, $q$EBC parking$q$, $q$Open excavation with exposed water pipes and a valve; debris/trash inside; soil, gravel and a concrete block nearby; no barriers or warning signs.$q$, $q$High$q$, $q$Install barriers/warning signs immediately, restrict access, arrange safe backfilling/permanent repair, verify safety before reopening.$q$, $q$Civil / MEP$q$, 'open', date '2026-09-30', date '2026-09-30' + 7, $q$No photo in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (18, $q$Roofs$q$, $q$Rooftop housekeeping$q$, $q$Outdoor split AC components and cartons remain on several rooftops.$q$, $q$Medium$q$, $q$Remove leftover materials and maintain housekeeping.$q$, $q$MEP / HVAC$q$, 'open', date '2026-09-30', date '2026-09-30' + 14, $q$Photo ref. P17 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (19, $q$ES5$q$, $q$Wall Repair$q$, $q$Wall marks and screw holes remain after fire hose cabinet relocation.$q$, $q$Medium$q$, $q$Repair and repaint the affected area.$q$, $q$Civil / Finishing$q$, 'open', date '2026-09-30', date '2026-09-30' + 14, $q$Photo ref. P16 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (20, $q$C2$q$, $q$Zone B, 4th Floor$q$, $q$Cracked glass above parked vehicles$q$, $q$High$q$, $q$Secure the area and replace the glass.$q$, $q$Maintenance / Facade$q$, 'open', date '2026-10-31', date '2026-10-31' + 7, $q$Photo ref. P18 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (21, $q$C2$q$, $q$Zone B, 2nd Floor$q$, $q$Two Cracked glass at the side$q$, $q$Medium$q$, $q$Secure the area and replace the glass.$q$, $q$Maintenance / Facade$q$, 'open', date '2026-10-31', date '2026-10-31' + 14, $q$Photo ref. P19 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (22, $q$C2$q$, $q$Zone B, 2nd Floor$q$, $q$Two Cracked glass at the side$q$, $q$Medium$q$, $q$Secure the area and replace the glass.$q$, $q$Maintenance / Facade$q$, 'open', date '2026-10-31', date '2026-10-31' + 14, $q$Photo ref. P20 in the October Excel.$q$, 'evan_mansour', 'evan_mansour'),
  (23, $q$C4–C6$q$, $q$Elevators$q$, $q$Elevator entrapment in C5, C6 due to power outage and UPS failure$q$, $q$High$q$, $q$Provide and install UPS systems for elevator in C4, C5 and C6.$q$, $q$Maintenance / Civil$q$, 'open', date '2026-10-31', date '2026-10-31' + 7, $q$No photo in the October Excel.$q$, 'evan_mansour', 'evan_mansour');

insert into public.hse_events (num, kind, building, location, happened_at, cause, outcome, status, created_by, updated_by) values
  (1, 'false_alarm', 'C2', 'PwC office area', timestamptz '2026-10-01 16:00:00+03', $q$Alarm panel indicated the PwC office area; likely dust from works entering through building shafts.$q$, $q$No injury or property damage. Followed up with the concerned personnel.$q$, 'closed', 'evan_mansour', 'evan_mansour');

insert into public.hse_months (month, workforce, working_days, hours_per_day, overall_status, summary, improved, updated_by) values
  ('2026-10', 189, 26, 8, $q$STABLE – Corrective Actions Required$q$, $q$During October 2026, I maintained active supervision of Security and Health, Safety & Environment (HSE) operations across Buildings C1 to C6 at Empire World. My responsibilities focused on daily security operations, staff performance, risk prevention, workplace safety, emergency preparedness, and maintaining a safe and organized environment for companies, employees and visitors.

1. Security Responsibilities
• Supervised security staff performance and monitored daily duties to ensure compliance with security procedures and instructions.
• Monitored access control procedures, building activities, and security conditions, ensuring awareness of unusual activities or suspicious behavior.
• Conducted daily security briefings to reinforce responsibilities, professional conduct, discipline, and respectful communication with company representatives, employees, and visitors.
• Strengthened emergency readiness by guiding security staff on appropriate responses, immediate reporting, and communication with relevant departments.
• Monitored general housekeeping and ensured that access routes and common areas remained clean, organized, and free from obstructions.

2. HSE Responsibilities
• Conducted regular site inspections to identify hazards, unsafe conditions, and potential risks, and followed up on corrective actions.
• Monitored fire safety arrangements and ensured that emergency exits, evacuation routes, and access pathways remained clear.
• Followed up on housekeeping standards and reported unsafe workplace conditions.
• Provided daily guidance and emergency preparedness training to security staff, covering emergency recognition, safe initial response, fire safety, incident reporting, and proper communication. Staff were briefed on what actions to take during emergencies and how to notify the relevant personnel.
• Focused on weather preparedness, particularly during rainfall, by instructing security staff to inspect rooftops, check drainage systems, and clear or open water channels and passageways to prevent blockages, water accumulation, and potential damage.
• Reinforced the importance of immediately reporting all incidents, hazards, unsafe conditions, and near misses, regardless of their severity.

3. Coordination, Follow-up & Corrective Actions
Coordinated with relevant departments to communicate security and HSE observations, report identified risks, and follow up on required corrective measures. Maintained documentation and monitored outstanding observations to ensure proper follow-up and prevent existing risks from being overlooked.

4. Monthly Performance – October 2026
• Reported Incidents: 0
• Accidents / Injuries: 0
• Lost Time Injuries (LTI): 0
• Inspection Observations: 23
• Observation Status: Documented in the HSE Observation Register and Action Plan for follow-up and corrective action.

Conclusion
Throughout October, my role focused on combining effective security supervision with active HSE management across Buildings C1 to C6. This included supervising security staff, strengthening discipline and awareness, conducting site inspections, identifying hazards, improving emergency preparedness, and coordinating with relevant departments to follow up on corrective actions.

The absence of reported incidents and injuries during the month reflects the continued focus on prevention, awareness, and early risk identification. Moving forward, priority will remain on following up on outstanding observations, improving security team performance, strengthening safety awareness, and maintaining a safe, clean, and professional working environment across C1 to C6.$q$, $q$Fire-water tank repairs followed up in C1 and C3.
Rooftop cleaning requested during the previous month was completed.
Routine HSE inspections continued throughout October.
Fire safety and emergency conditions were monitored.
Outstanding safety observations were identified and communicated.$q$, 'evan_mansour')
on conflict (month) do nothing;

insert into public.id_counters (key, value) values ('hse_observation', 23), ('hse_event', 1)
on conflict (key) do update set value = greatest(public.id_counters.value, excluded.value);

commit;
