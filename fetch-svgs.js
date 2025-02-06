const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

// Apply stealth plugin
puppeteer.use(StealthPlugin());

const OUTPUT_FILE = "svgs.json";
const REFERRAL_ID = "ref/3664181/";
const SOURCE_URL = "https://www.creativefabrica.com/tag/svg/?orderby=popularity";

async function fetchSVGs() {
  console.log("🚀 Launching browser...");
  const browser = await puppeteer.launch({
    headless: true, // Now it should work in headless mode
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled", // Hides Puppeteer from detection
    ],
  });

  const page = await browser.newPage();

  console.log("🌍 Navigating to Creative Fabrica...");
  await page.goto(SOURCE_URL, { waitUntil: "networkidle2" });

  console.log("🖱️ Clicking on the page to trigger loading...");
  await page.click("body"); // Some sites require user interaction

  // Scroll dynamically until no new content loads
  console.log("⏳ Scrolling to load all items...");
  let previousHeight = 0;
  for (let i = 0; i < 10; i++) {
    previousHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait longer for lazy loading
    let newHeight = await page.evaluate(() => document.body.scrollHeight);

    if (newHeight === previousHeight) {
      console.log("✅ No more content to load.");
      break;
    }
  }

  // Wait for elements
  try {
    await page.waitForSelector(".col-card", { timeout: 25000 });
  } catch (error) {
    console.error('❌ Elements did not load. Check "debug.png" for what Puppeteer sees.');
    await browser.close();
    return;
  }

  console.log("✅ Collecting SVG data...");
  const results = await page.evaluate((REFERRAL_ID) => {
    let items = [];
    document.querySelectorAll(".col-card").forEach((element) => {
      let titleElement = element.querySelector(".c-product-box__title a");
      let imageElement = element.querySelector(".c-product-box a img");

      if (titleElement && imageElement) {
        let title = titleElement.getAttribute("title").trim();
        let image = imageElement.getAttribute("src") || imageElement.getAttribute("data-src");
        let link = titleElement.getAttribute("href") + REFERRAL_ID;

        items.push({ title, image, link });
      }
    });
    return items;
  }, REFERRAL_ID);

  console.log(`✅ Scraped ${results.length} SVGs`);

  // Save results to JSON file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`✅ SVG data saved to ${OUTPUT_FILE}`);

  await browser.close();
  console.log("🔒 Browser closed.");
}

// Run the scraper
fetchSVGs().catch((error) => console.error("❌ Scraper Error:", error));
