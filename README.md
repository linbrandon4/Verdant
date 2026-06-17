## Inspiration

Cities depend on roads, bridges, and public buildings daily, but visible damage is often noticed too late. Our team has seen these effects firsthand, as just recently, Atlanta residents were left without clean water for a week. This was due to vulnerabilities in the city's infrastructure because such issues were managed on a crisis-to-crisis basis instead of addressing the issue of leaky pipes early, before they became significant. Therefore, small cracks, potholes, surface wear, and structural issues can lead to costly repairs. These typically require more materials, demolition, and waste, and so this is not just a safety and maintenance issue; it’s also a sustainability issue. 

To counteract this, we thought about effective ways to address this problem and realized that cities could use drone images to check their infrastructure sooner. This allows for smarter repair decisions because instead of waiting for damage to worsen, Verdant helps spot problems early. It suggests sustainable repair options that lower waste, cost, and environmental impact. 

## What it does

Verdant analyzes drone images of roads and buildings to detect visible infrastructure damage. After an image is uploaded, the system identifies damaged areas, estimates severity, and generates a repair report with sustainable recommendations.

The goal is to help city teams answer questions such as:

* Where is the damage?
* How severe is it?
* How urgent is the repair?
* What would it cost to fix?
* Is there a more sustainable repair option?
* How much waste or carbon impact could be avoided?

By combining computer vision with AI-generated repair intelligence, Verdant turns inspection images into actionable, sustainability-focused infrastructure reports.

## How we built it

We built Verdant as a full-stack web application that lets users upload drone images of roads and buildings and receive an AI-generated infrastructure inspection report.

For the frontend, we used **React**, **TypeScript**, and **Vite** to build a fast web app with a landing page, an authentication page, and a protected dashboard. We used **React Router** for navigation, **Lucide React** for icons, and custom **CSS** for the interface. The dashboard lets users upload inspection images and view results in a clean report format.

For the backend, we built an image-processing pipeline that prepares uploaded drone images for AI analysis. The image is processed by a **YOLOv8 computer vision model**, which detects visible infrastructure damage such as cracks, potholes, broken pavement, and surface deterioration. The model returns the damage type, location, and confidence score for each detected issue.

After detection, we built a custom analysis layer that converts raw detection results into a structured infrastructure report. This report includes a severity score, estimated repair cost, suggested repair timeline, and recommended next steps. Rather than showing only detection boxes on an image, Verdant explains what the damage means and how urgently it should be addressed.

A simplified version of our pipeline is:

$$
\text{Drone Image} \rightarrow \text{YOLOv8 Detection} \rightarrow \text{Custom Report Analysis} \rightarrow \text{Inspection Dashboard}
$$

## Challenges we ran into

One challenge was ensuring Verdant felt like more than just a damage detector. We aimed for the project to turn drone images into practical inspection reports that include severity, repair urgency, and cost estimates. Another challenge involved linking infrastructure damage to sustainability. We realized that late repairs often need more demolition, materials, and waste, making early detection crucial for sustainability.

## Accomplishments we're proud of

We are proud that Verdant merges drone imagery, AI damage detection, and repair reporting into a single workflow. We also take pride in creating a clean dashboard that makes the results easy to understand.

## What we learned

We learned that AI predictions are only valuable if they are easy to interpret. A city worker needs to know not just that damage exists but also how serious it is and what steps to take next. Additionally, we learned that sustainable infrastructure requires maintaining roads and buildings earlier, addressing small issues before they grow into larger, wasteful repairs. 

## What's next for Verdant

Next, we want Verdant to expand beyond Atlanta and help cities across the country monitor roads, bridges, and public buildings more effectively. We also aim to move from drone images to satellite imagery, allowing Verdant to spot larger areas at risk before utilizing drones for detailed inspections. In the long term, Verdant could develop into a citywide infrastructure intelligence platform that promotes earlier repairs, reduces waste, and supports more sustainable maintenance decisions.
