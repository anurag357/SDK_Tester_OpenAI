// app/api/automate/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { faker } from "@faker-js/faker";

// --- Helper functions ---
function ensureScreenshotsDir() {
  const dir = path.join(process.cwd(), "public", "screenshots");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function filenameFor(step) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safe = step.replace(/\s+/g, "_").toLowerCase();
  return `${ts}__${safe}.png`;
}

// --- Main GET handler ---
export async function GET() {
  ensureScreenshotsDir();
  let browser;
  let page;
  let isPuppeteer = false;


  try {
    // --- Launch browser ---
    if (process.env.VERCEL === "1") {
      // Vercel serverless - use chrome-aws-lambda
      isPuppeteer = true;
      const chromium = require('@sparticuz/chromium');
      const puppeteer = require('puppeteer-core');
      
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      // Local development - use Playwright
      const { chromium } = require('playwright');
      browser = await chromium.launch({
        headless: true,
        devtools: false,
      });
    }

    page = await browser.newPage();
    if (isPuppeteer) {
      // Puppeteer method
      await page.setViewport({ width: 1280, height: 720 });
    } else {
      // Playwright method
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    // --- Generate dummy data ---
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName });
    const password = faker.internet.password({ length: 12 });
    const confirmPassword = password;

    // --- Tools ---
    const takeScreenshot = tool({
      name: "take_screenshot",
      description: "Take a screenshot. Saves it in /public/screenshots and returns {path,url}.",
      parameters: z.object({
        step: z.string(),
        fullPage: z.boolean().default(false),
      }),
      async execute({ step, fullPage }) {
        const file = filenameFor(step);
        const abs = path.join(process.cwd(), "public", "screenshots", file);
        await page.screenshot({ path: abs, fullPage });
        const url = `/screenshots/${file}`;
        return { path: abs, url };
      },
    });

    const openURL = tool({
      name: "open_url",
      description: "Navigate to a URL.",
      parameters: z.object({ url: z.string() }),
      async execute({ url }) {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        return `Opened ${url}`;
      },
    });

    const click = tool({
      name: "click",
      description: "Click an element by selector.",
      parameters: z.object({
        selector: z.string(),
        timeoutMs: z.number().default(10000),
      }),
      async execute({ selector, timeoutMs }) {
        await page.waitForSelector(selector, { timeout: timeoutMs });
        await page.click(selector);
        return `Clicked ${selector}`;
      },
    });

    const typeText = tool({
      name: "type_text",
      description: "Fill an input field.",
      parameters: z.object({
        selector: z.string(),
        text: z.string(),
        timeoutMs: z.number().default(10000),
      }),
      async execute({ selector, text, timeoutMs }) {
        await page.waitForSelector(selector, { timeout: timeoutMs });
        await page.type(selector, text, { delay: 100 });
        return `Filled ${selector}`;
      },
    });

    const waitFor = tool({
      name: "wait_for",
      description: "Wait for a selector to appear.",
      parameters: z.object({
        selector: z.string(),
        timeoutMs: z.number().default(15000),
      }),
      async execute({ selector, timeoutMs }) {
        await page.waitForSelector(selector, { timeout: timeoutMs });
        return `Found ${selector}`;
      },
    });

    // --- Agent ---
    const websiteAutomationAgent = new Agent({
      name: "Website Automation Agent",
      instructions: `
You are automating signup at https://ui.chaicode.com/auth/signup.
Steps:
1) Navigate to the signup page
2) Take screenshot of loaded form
3) Fill first name: ${firstName}
4) Fill last name: ${lastName}
5) Fill email: ${email}
6) Fill password: ${password}
7) Fill confirm password: ${confirmPassword}
8) Take screenshot of filled form
9) Click submit button
10) Take screenshot after submission
Return all screenshot URLs.
`,
      tools: [openURL, click, typeText, waitFor, takeScreenshot],
    });

    const result = await run(
      websiteAutomationAgent,
      "Automate signup and capture screenshots.",
      { maxTurns: 15, timeout: 120000 } // 2 minute timeout
    );

    return NextResponse.json(
      {
        success: true,
        dummyData: { firstName, lastName, email, password, confirmPassword },
        finalOutput: result.finalOutput,
      },
      { status: 200 }
    );

  } catch (err) {
    console.error("Automation error:", err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }
  }
}