// app/api/automate/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { faker } from "@faker-js/faker";

// --- Main GET handler ---
export async function GET() {
  let browser;
  let page;
  let isPuppeteer = false;
  const screenshots = []; // Store base64 screenshots
  const logs = []; // Store detailed logs

  try {
    // --- Launch browser ---
    if (process.env.VERCEL === "1") {
      // Vercel serverless - use chrome-aws-lambda
      isPuppeteer = true;
      const chromium = require('@sparticuz/chromium');
      const puppeteer = require('puppeteer-core');
      
      logs.push("Initializing Chromium for Vercel...");
      
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--single-process',
          '--no-zygote',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        defaultViewport: { width: 1280, height: 720 },
        executablePath: await chromium.executablePath(),
        headless: true,
        ignoreHTTPSErrors: true,
        timeout: 60000
      });
    } else {
      // Local development - use Playwright
      const { chromium } = require('playwright');
      logs.push("Initializing Playwright for local development...");
      browser = await chromium.launch({
        headless: false,
        devtools: false,
      });
    }

    logs.push("Browser launched successfully");
    
    page = await browser.newPage();
    logs.push("New page created");
    
    if (isPuppeteer) {
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/120.0.0.0 Safari/537.36"
      );
      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
      });
      logs.push("Applied stealth-like headers for Vercel");
    } else {
      await page.setViewportSize({ width: 1280, height: 720 });
    }

    // Set longer timeouts
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(30000);
    logs.push("Viewport and timeouts configured");

    // --- Generate dummy data ---
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName });
    const password = faker.internet.password({ length: 12 });
    const confirmPassword = password;

    logs.push(`Generated dummy data: ${firstName} ${lastName}, ${email}`);

    // --- Enhanced Tools ---
    const takeScreenshot = tool({
      name: "take_screenshot",
      description: "Take a screenshot and return base64 data.",
      parameters: z.object({
        step: z.string(),
        fullPage: z.boolean().default(false),
      }),
      async execute({ step, fullPage }) {
        try {
          logs.push(`Taking screenshot: ${step}`);
          let screenshotData;
          
          if (isPuppeteer) {
            screenshotData = await page.screenshot({ 
              encoding: 'base64',
              fullPage 
            });
          } else {
            const buffer = await page.screenshot({ fullPage });
            screenshotData = buffer.toString('base64');
          }
          
          const timestamp = new Date().toISOString();
          const safeStep = step.replace(/\s+/g, "_").toLowerCase();
          
          screenshots.push({
            step,
            data: `data:image/png;base64,${screenshotData}`,
            filename: `${timestamp}__${safeStep}.png`
          });
          
          return `Screenshot taken for: ${step}`;
        } catch (error) {
          const errorMsg = `Screenshot error: ${error.message}`;
          logs.push(errorMsg);
          return errorMsg;
        }
      },
    });

    // const openURL = tool({
    //   name: "open_url",
    //   description: "Navigate to a URL.",
    //   parameters: z.object({ url: z.string() }),
    //   async execute({ url }) {
    //     try {
    //       logs.push(`Navigating to: ${url}`);
          
    //       // Try multiple navigation strategies
    //       const navigationOptions = {
    //         waitUntil: 'domcontentloaded',
    //         timeout: 45000
    //       };

    //       if (isPuppeteer) {
    //         await page.goto(url, navigationOptions);
    //       } else {
    //         await page.goto(url, navigationOptions);
    //       }

    //       // Get page title to verify navigation
    //       const title = await page.title();
    //       const currentUrl = await page.url();
          
    //       logs.push(`Navigation successful - Title: "${title}", URL: ${currentUrl}`);
          
    //       await new Promise(resolve => setTimeout(resolve, 3000));
    //       return `Successfully opened ${url}. Page title: "${title}"`;
    //     } catch (error) {
    //       const errorMsg = `Navigation error: ${error.message}`;
    //       logs.push(errorMsg);
          
    //       // Try to get current page state for debugging
    //       try {
    //         const currentUrl = await page.url();
    //         logs.push(`Current URL after failure: ${currentUrl}`);
    //       } catch (e) {
    //         logs.push(`Could not get current URL: ${e.message}`);
    //       }
          
    //       throw new Error(`Failed to navigate to ${url}: ${error.message}`);
    //     }
    //   },
    // });


    const openURL = tool({
      name: "open_url",
      description: "Navigate to a URL.",
      parameters: z.object({ url: z.string() }),
      async execute({ url }) {
        try {
          logs.push(`Navigating to: ${url}`);
          
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    
          // --- Retry loop for Cloudflare/JS challenge ---
          let formFound = false;
          for (let i = 0; i < 3; i++) {
            const hasForm = await page.$("#firstName");
            if (hasForm) {
              formFound = true;
              logs.push("Signup form detected!");
              break;
            }
            logs.push(`Signup form not found, retry ${i + 1}/3... waiting 5s`);
            await new Promise(r => setTimeout(r, 5000));
            await page.reload({ waitUntil: "domcontentloaded" });
          }
    
          if (!formFound) {
            logs.push("Signup form still not detected after retries.");
          }
    
          const title = await page.title();
          const currentUrl = await page.url();
          logs.push(`Navigation complete - Title: "${title}", URL: ${currentUrl}`);
    
          return `Opened ${url}. Page title: "${title}". Form detected: ${formFound}`;
        } catch (error) {
          const errorMsg = `Navigation error: ${error.message}`;
          logs.push(errorMsg);
          try {
            const currentUrl = await page.url();
            logs.push(`Current URL after failure: ${currentUrl}`);
          } catch (e) {
            logs.push(`Could not get current URL: ${e.message}`);
          }
          throw new Error(`Failed to navigate to ${url}: ${error.message}`);
        }
      },
    });
    
    const click = tool({
      name: "click",
      description: "Click an element by selector.",
      parameters: z.object({
        selector: z.string(),
        timeoutMs: z.number().default(15000),
      }),
      async execute({ selector, timeoutMs }) {
        try {
          logs.push(`Attempting to click: ${selector}`);
          await page.waitForSelector(selector, { timeout: timeoutMs });
          await page.click(selector);
          logs.push(`Successfully clicked: ${selector}`);
          return `Clicked ${selector}`;
        } catch (error) {
          const errorMsg = `Click failed on ${selector}: ${error.message}`;
          logs.push(errorMsg);
          throw new Error(`Failed to click ${selector}: ${error.message}`);
        }
      },
    });

    const typeText = tool({
      name: "type_text",
      description: "Fill an input field.",
      parameters: z.object({
        selector: z.string(),
        text: z.string(),
        timeoutMs: z.number().default(15000),
      }),
      async execute({ selector, text, timeoutMs }) {
        try {
          logs.push(`Typing into ${selector}: ${text.substring(0, 5)}...`);
          await page.waitForSelector(selector, { timeout: timeoutMs });
          await page.focus(selector);
          await page.type(selector, text, { delay: 50 });
          logs.push(`Successfully typed into: ${selector}`);
          return `Filled ${selector}`;
        } catch (error) {
          const errorMsg = `Type failed on ${selector}: ${error.message}`;
          logs.push(errorMsg);
          throw new Error(`Failed to type in ${selector}: ${error.message}`);
        }
      },
    });

    const waitFor = tool({
      name: "wait_for",
      description: "Wait for a selector to appear.",
      parameters: z.object({
        selector: z.string(),
        timeoutMs: z.number().default(20000),
      }),
      async execute({ selector, timeoutMs }) {
        try {
          logs.push(`Waiting for: ${selector}`);
          await page.waitForSelector(selector, { timeout: timeoutMs });
          logs.push(`Found: ${selector}`);
          return `Found ${selector}`;
        } catch (error) {
          const errorMsg = `Wait for ${selector} failed: ${error.message}`;
          logs.push(errorMsg);
          throw new Error(`Element ${selector} not found: ${error.message}`);
        }
      },
    });

    // --- Agent ---
    const websiteAutomationAgent = new Agent({
      name: "Website Automation Agent",
      instructions: `
You are automating signup at https://ui.chaicode.com/auth/signup.
Rules:
- After each action, call take_screenshot with a descriptive step.
- Use reliable CSS selectors from the form (#firstName, #lastName, #email, #password, #confirmPassword).
- Fill out the form with dummy generated data.
Steps:
1) open_url("https://ui.chaicode.com/auth/signup")
2) take_screenshot("signup_form_loaded")
3) type_text(selector="#firstName", text="${firstName}")
4) type_text(selector="#lastName", text="${lastName}")
5) type_text(selector="#email", text="${email}")
6) type_text(selector="#password", text="${password}")
7) type_text(selector="#confirmPassword", text="${confirmPassword}")
8) take_screenshot("form_filled")
9) click(selector="button[type='submit']", role="", name="", nth=0)
10) take_screenshot("submitted")
Return all screenshot urls you produced.
`,
      tools: [openURL, click, typeText, waitFor, takeScreenshot],
    });

    logs.push("Starting automation...");
    const result = await run(
      websiteAutomationAgent,
      "Automate signup and capture screenshots. If navigation fails, provide detailed error information.",
      { maxTurns: 30, timeout: 180000 }
    );

    logs.push("Automation completed");

    return NextResponse.json(
      {
        success: true,
        dummyData: { firstName, lastName, email, password, confirmPassword },
        finalOutput: result.finalOutput,
        screenshots: screenshots,
        logs: logs, // Include detailed logs for debugging
        environment: isPuppeteer ? "vercel" : "local"
      },
      { status: 200 }
    );

  } catch (err) {
    console.error("Automation error:", err);
    logs.push(`Final error: ${err.message}`);
    
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      screenshots: screenshots,
      logs: logs, // Include logs even on error
      environment: isPuppeteer ? "vercel" : "local"
    }, { status: 500 });
  } finally {
    if (browser) {
      try {
        await browser.close();
        logs.push("Browser closed successfully");
      } catch (closeError) {
        logs.push(`Error closing browser: ${closeError.message}`);
      }
    }
  }
}