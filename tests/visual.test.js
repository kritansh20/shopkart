'use strict';

const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');

describe('BStackDemo Visual Tests', function () {
  this.timeout(60000);

  let driver;

  beforeEach(async function () {
    driver = await new Builder().forBrowser('chrome').build();
  });

  afterEach(async function () {
    if (driver) {
      await driver.quit();
    }
  });

  it('Homepage — product grid loads', async function () {
    await driver.get('https://bstackdemo.com/');
    await driver.wait(until.elementLocated(By.css('[id="1"]')), 10000);
    // Interact: add iPhone 12 to cart (triggers Percy auto-capture)
    const addToCart = await driver.findElement(By.xpath('/html[1]/body[1]/div[1]/div[1]/div[1]/main[1]/div[2]/div[3]/div[4]'));
    await addToCart.click();
    await driver.sleep(1000);
  });

  it('Sign-in page — login form renders', async function () {
    await driver.get('https://bstackdemo.com/signin');
    await driver.wait(until.elementLocated(By.id('login-btn')), 10000);
    // Interact: open username dropdown via JS mousedown (React-Select)
    await driver.executeScript(`
      const control = document.querySelector('#react-select-2-input')
        .closest('[class*="container"]')
        .querySelector('[class*="control"]');
      control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    `);
    await driver.sleep(500);
    // Select demouser
    const demouser = await driver.wait(
      until.elementLocated(By.xpath('/html[1]/body[1]/div[1]/div[2]/div[1]/form[1]/div[2]/div[1]/div[2]/div[1]/div[1]/div[2]/div[1]')),
      5000
    );
    await demouser.click();
    await driver.sleep(300);
    // Open password dropdown
    await driver.executeScript(`
      const control = document.querySelector('#react-select-3-input')
        .closest('[class*="container"]')
        .querySelector('[class*="control"]');
      control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    `);
    await driver.sleep(500);
    // Select testingisfun99
    const password = await driver.wait(
      until.elementLocated(By.xpath('/html[1]/body[1]/div[1]/div[2]/div[1]/form[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[2]/div[1]')),
      5000
    );
    await password.click();
    await driver.sleep(300);
    // Click LOG IN (triggers Percy auto-capture)
    await driver.findElement(By.id('login-btn')).click();
    await driver.wait(until.urlContains('signin=true'), 10000);
  });
});
