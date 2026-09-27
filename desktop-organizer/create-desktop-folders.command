#!/bin/bash
# Creates an organized folder structure on your Mac desktop.
# Safe to run more than once: existing folders and files are never touched.

DESKTOP="$HOME/Desktop"

folders=(
  # ---- Inbox: drop anything here first, sort it later ----
  "00 Inbox"

  # ---- Ministry / church work ----
  "01 Ministry/Sermons & Teaching/_Template Series/1 Research & Notes"
  "01 Ministry/Sermons & Teaching/_Template Series/2 Outlines"
  "01 Ministry/Sermons & Teaching/_Template Series/3 Manuscripts"
  "01 Ministry/Sermons & Teaching/_Template Series/4 Slides & Media"
  "01 Ministry/Sermons & Teaching/_Template Series/5 Handouts & Discussion Guides"
  "01 Ministry/Sermons & Teaching/Illustrations & Stories"
  "01 Ministry/Youth Ministry/Weekly Programs"
  "01 Ministry/Youth Ministry/Small Groups"
  "01 Ministry/Youth Ministry/Retreats & Camps"
  "01 Ministry/Youth Ministry/Games & Activities"
  "01 Ministry/Events/_Template Event/1 Planning & Run Sheet"
  "01 Ministry/Events/_Template Event/2 Promo & Graphics"
  "01 Ministry/Events/_Template Event/3 Budget & Receipts"
  "01 Ministry/Events/_Template Event/4 Forms & Permission Slips"
  "01 Ministry/Events/_Template Event/5 Photos & Recap"
  "01 Ministry/Volunteers & Leaders/Applications & Background Checks"
  "01 Ministry/Volunteers & Leaders/Training"
  "01 Ministry/Volunteers & Leaders/Schedules"
  "01 Ministry/Worship & Services"
  "01 Ministry/Admin/Budget & Finance"
  "01 Ministry/Admin/Policies & Procedures"
  "01 Ministry/Admin/Meetings & Notes"
  "01 Ministry/Admin/Reports"
  "01 Ministry/Graphics & Media/Logos & Branding"
  "01 Ministry/Graphics & Media/Photos"
  "01 Ministry/Graphics & Media/Videos"
  "01 Ministry/Graphics & Media/Canva Exports"
  "01 Ministry/Resources & Curriculum"

  # ---- Personal ----
  "02 Personal/Finances/Taxes"
  "02 Personal/Finances/Bank Statements"
  "02 Personal/Finances/Bills & Receipts"
  "02 Personal/Finances/Budget"
  "02 Personal/Documents & IDs"
  "02 Personal/Home"
  "02 Personal/Health"
  "02 Personal/Family"
  "02 Personal/Car"
  "02 Personal/Photos"

  # ---- Projects / coding ----
  "03 Projects & Coding/Active"
  "03 Projects & Coding/Ideas"
  "03 Projects & Coding/Snippets & Notes"
  "03 Projects & Coding/Tools & Setup"
  "03 Projects & Coding/_Template Project/src"
  "03 Projects & Coding/_Template Project/docs"
  "03 Projects & Coding/_Template Project/assets"

  # ---- School / learning ----
  "04 School & Learning/Courses/_Template Course/Notes"
  "04 School & Learning/Courses/_Template Course/Assignments"
  "04 School & Learning/Courses/_Template Course/Readings"
  "04 School & Learning/Courses/_Template Course/Exams & Study Guides"
  "04 School & Learning/Books & Reading Notes"
  "04 School & Learning/Research"
  "04 School & Learning/Certificates & Transcripts"

  # ---- 3D prints ----
  "05 3D Prints/Models to Print/Downloaded (STL & 3MF)"
  "05 3D Prints/Models to Print/My Designs"
  "05 3D Prints/Design Files (CAD Source)"
  "05 3D Prints/Sliced (G-code)"
  "05 3D Prints/Printed/Photos"
  "05 3D Prints/Printer Settings/Filament Profiles"
  "05 3D Prints/Printer Settings/Slicer Profiles"
  "05 3D Prints/Maintenance & Parts"
  "05 3D Prints/Ideas & Requests"

  # ---- Archive: finished things move here, same layout as above ----
  "99 Archive/01 Ministry"
  "99 Archive/02 Personal"
  "99 Archive/03 Projects & Coding"
  "99 Archive/04 School & Learning"
  "99 Archive/05 3D Prints"
)

created=0
for f in "${folders[@]}"; do
  if [ ! -d "$DESKTOP/$f" ]; then
    mkdir -p "$DESKTOP/$f" && created=$((created + 1))
  fi
done

guide="$DESKTOP/00 Inbox/_How this works.txt"
if [ ! -f "$guide" ]; then
  cat > "$guide" <<'TXT'
HOW THIS FOLDER SYSTEM WORKS

1. New stuff lands in 00 Inbox. Downloads, screenshots, anything.
2. Once a week, empty the Inbox into the numbered folders.
3. Starting something that repeats (a sermon series, an event, a course,
   a coding project)? Duplicate the "_Template ..." folder (Cmd+D) and rename it.
   Tip: start names with the date, e.g. "2026-10 Fall Retreat".
4. Finished with something? Move it to 99 Archive under the matching area.
   Don't delete it. Archive keeps your working folders short.
TXT
fi

echo "Done. Created $created new folder(s) on your Desktop."
