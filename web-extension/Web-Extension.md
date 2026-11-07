# Protego - Web Extension

## Important

- Backend functions must be usable for a mobile app and website
- Majority of your backend must be built on Spacetime.

## General

Runs in the background of your browser checking and removing any hazards/scams. On new website will run a security check in order to show the user how safe the website with a security report. Addtionally it will block fake job listings and scholarships(when applicable).  
By default when not on a website on click will show:
![Default popup to input url to check a website](image-3.png)

## Website Security Check

On new website checks entire website and fact checks to ensure it's trustworthy. Risk ratings are None(no issues), Low(some suspicous things, but generally safe), Medium(suspicous or bad practice, but nothing dangerous), High(Highly suspicous and dangerous or on scamming/fraud lists). Some things that contribute to the rating:

- Website Age
- Company Verification(Registered company?)
- Public Opinion
- Suspicous Scripts
- On Scamming/Fraud Lists
- etc.

  This will likely use an agent to do the rating with most of the code being remote.  
   If no risk is detected will show a popup like this(empty circle will be replaced with icon later):
  ![protego no risk detected](image.png)
  If there is a risk based on the level it will show a popup(react modal like over original website ) like this with the arrow getting worse the higher the risk:
  ![Popup risk detected](image-1.png)

## Fake Listing Detection

This feature will remove listings that are suspicous on Job Boards/Scholarship/Apartments(more later for now focus on these three). This will also use agentic AI in order

When on site with fake listings replaces normal on extension icon click popup with this:
![Listings blocked popup](image-2.png)

## Frontend / Non-Functional extras

- Replace the grayed out images with the corresponding icons
- When seeing a site, Protego will enter the screen, pull open the site, find the hornet, and KILL IT. It will then give a reason for the site being broken(popup in middle of browser with report information).
