const { Builder, By, until } = require('selenium-webdriver');

describe('BStackDemo Visual Regression', function () {
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

  it('Homepage — product listing', async function () {
    await driver.get('https://bstackdemo.com/');
    // Wait for products to load
    await driver.wait(until.elementLocated(By.css('.shelf-item')), 15000);
    // Interact so percyCaptureMode:auto captures a snapshot
    const addToCartBtn = await driver.findElement(By.css('.shelf-item__buy-btn'));
    await addToCartBtn.click();
    // Wait for cart to update
    await driver.wait(until.elementLocated(By.css('.float-cart__content')), 10000);
  });

  it('Sign In page', async function () {
    await driver.get('https://bstackdemo.com/signin');
    // Wait for login form
    await driver.wait(until.elementLocated(By.id('login-btn')), 15000);
    // Interact with the login button so Percy captures the page
    const loginBtn = await driver.findElement(By.id('login-btn'));
    await loginBtn.click();
  });
});
