# Desktop Organizer (Mac)

Creates an organized folder system on your Mac desktop.

## How to run

**Option A (double-click):** Download `create-desktop-folders.command` and double-click it.
If macOS blocks it the first time, right-click the file, choose **Open**, then click **Open** again.

**Option B (Terminal):** Open Terminal, type `bash ` (with a space after it), drag the file into the window, and press Return.

You can run it again at any time. It only adds missing folders and never changes or deletes your files.

## What you get

```
00 Inbox                 ← everything new lands here; sort weekly
01 Ministry
   Sermons & Teaching/_Template Series/ (Research, Outlines, Manuscripts, Slides, Handouts)
   Youth Ministry/       (Weekly Programs, Small Groups, Retreats & Camps, Games)
   Events/_Template Event/ (Planning, Promo, Budget, Forms, Photos)
   Volunteers & Leaders/ Worship & Services/ Admin/ Graphics & Media/ Resources & Curriculum/
02 Personal              Finances/ Documents & IDs/ Home/ Health/ Family/ Car/ Photos/
03 Projects & Coding     Active/ Ideas/ Snippets & Notes/ Tools & Setup/ _Template Project/
04 School & Learning     Courses/_Template Course/ Books & Reading Notes/ Research/ Certificates/
05 3D Prints             Models to Print/ Design Files/ Sliced (G-code)/ Printed/ Printer Settings/ Maintenance/ Ideas/
99 Archive               finished work, same areas as above
```

## Habits that keep it working

1. Save everything to **00 Inbox** first, then empty it once a week.
2. For repeating work, duplicate a `_Template …` folder (Cmd+D) and rename it with a date, e.g. `2026-10 Fall Retreat`.
3. When something is finished, move it to **99 Archive**. Don't delete it.

To change the folders, edit the `folders=( … )` list at the top of the script.
