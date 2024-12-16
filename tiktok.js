
(async () => {

    // Launch the browser in headful mode for debugging; set headless: false if you want to see the browser
    const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
    const context = await browser.newContext();
    const connection = await getDatabaseConnection()




    // Set viewport to full-screen dimensions

    // Path to the cookies file
    const cookiesFilePath = 'tiktok_cookies.json';

    // Check if the cookies file exists
    if (fs.existsSync(cookiesFilePath)) {
        // Read the cookies from the file
        const cookies = fs.readFileSync(cookiesFilePath, 'utf8');
        const deserializedCookies = JSON.parse(cookies).map(cookie => {
            // Ensure cookies have the right format and attributes
            if (!['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
                cookie.sameSite = 'None';
                cookie.secure = true; // Set secure to true if sameSite is None
            }
            return cookie;
        });;
        // Add each cookie to the browser context
        await context.addCookies(deserializedCookies);
        console.log('Cookies loaded successfully.');
    } else {
        console.log('No cookies file found. Proceeding to login.');
    }

    // Create a new page
    const page = await context.newPage();

    // Navigate to a page that requires authentication to verify if the session is recognized
    await page.goto('https://www.tiktok.com/explore', { waitUntil: 'domcontentloaded' });  // Change this URL to the appropriate one for your use case
   
  

    // If cookies are not valid or session is not recognized, log in manually
    if (await page.$('.tiktok-11sviba-Button-StyledButton.ehk74z00') !== null) {
        // Fill in the username and password (as fallback if cookies are expired or invalid)
        await page.type('.tiktok-11to27l-InputContainer.etcs7ny1[type="text"]', 'your_username');
        await page.type('.tiktok-wv3bkt-InputContainer.etcs7ny1[type="password"]', 'your_password');
        await page.click('.tiktok-11sviba-Button-StyledButton.ehk74z00'); // Click the login button

        // Wait for navigation after the login
        await page.waitForNavigation();

        // Save the new cookies to a file
        const newCookies = await context.cookies();
        fs.writeFileSync(cookiesFilePath, JSON.stringify(newCookies, null, 2));
        console.log('New cookies have been saved.');
    }

    const newCookies = await context.cookies();
    fs.writeFileSync('tiktok_cookies.json', JSON.stringify(newCookies, null, 2));
    console.log("cookies are updated...")

    // Locate the search box using the specific class for the input and type a query
    // await page.waitForSelector('.css-1geqepl-InputElement.e14ntknm3', { state: 'visible' });
    // await page.click('.css-1geqepl-InputElement.e14ntknm3', { clickCount: 1 });
    // await page.type('.css-1geqepl-InputElement.e14ntknm3', 'diwali 2024');
    // // Optionally, wait for suggestions to appear if applicable
    // await page.waitForSelector('selector_of_suggested_results', { state: 'visible' });



    try {

        await page.waitForSelector('.TUXButton-content', { state: 'visible' })

        await page.click('.TUXButton-content');


        await page.waitForTimeout(3000)


        await page.locator('input[name="q"]').nth(1).click({ force: true });

        // Trying with the name attribute
        //await page.waitForSelector('input[name="q"]', { state: 'visible' });
        await page.type('input[name="q"]', 'Mountain');

        // Submit the search
        await page.press('input[name="q"]', 'Enter');  // Simulate pressing Enter to search
        await page.waitForNavigation();  // Wait for the search results page to load

        console.log('Search completed successfully.');
    } catch (error) {
        console.error('Error performing search:', error);
    }

    
    



    // Click the search button

    // Function to scroll the page dynamically
    const scrollPage = async (page, scrollCount = 3, delay = 1000) => {
        for (let i = 0; i < scrollCount; i++) {
            await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight); // Scroll down by one viewport height
            });
            await page.waitForTimeout(delay); // Wait for content to load
        }
    };

    // Scroll the page 3 times dynamically
    await scrollPage(page, 3);
   


    // Wait for the elements to ensure they're loaded

    page.waitForSelector('a[href*="/video/"]')
   
   
    await page.waitForTimeout(10000)


    // Extract and transform links after scrolling
    const links = await page.evaluate(() => {
        // Find all anchor tags with hrefs containing '/video/'
        const anchors = Array.from(document.querySelectorAll('a[href*="/video/"]'));

        // Transform the links by removing '/video/{id}' segment
        return anchors.map(anchor => {
            const href = anchor.href;
            const baseUrl = href.split('/video/')[0]; // Remove the '/video/{id}' part
            return baseUrl;
        });
    });




    // Print the transformed links
    console.log('Extracted Links:', links);

    await page.waitForTimeout(10000)


    const userData = []; // Array to store extracted user data

    // Function to extract user data
    for (const link of links) {
        try {
          // Navigate to the profile page
          await page.goto(link, { waitUntil: 'domcontentloaded' });
   

          await page.waitForTimeout(5000)


    
          // Wait for the user container to load
          const containerSelector = 'div[data-e2e="user-title"], div[class*="DivShareTitleContainer"]';
          await page.waitForSelector(containerSelector);
    
          // Extract user details dynamically
          const data = await page.evaluate(() => {
            const container = document.querySelector('div[data-e2e="user-title"], div[class*="DivShareTitleContainer"]');
            if (!container) return null;
    
            // Extract user title and subtitle
            const userTitle = container.querySelector('[data-e2e="user-title"]')?.textContent.trim() || null;
            const userSubtitle = container.querySelector('[data-e2e="user-subtitle"]')?.textContent.trim() || null;
    
            // Extract metrics: Following, Followers, and Likes
            const following = container.querySelector('[data-e2e="following-count"]')?.textContent.trim() || null;
            const followers = container.querySelector('[data-e2e="followers-count"]')?.textContent.trim() || null;
            const likes = container.querySelector('[data-e2e="likes-count"]')?.textContent.trim() || null;
    
            // Extract bio
            let bio = container.querySelector('[data-e2e="user-bio"] .css-lesntn-DivBioText')?.textContent.trim() || null;
    
            return { userTitle, userSubtitle, following, followers, likes, bio };
          });
    
          // Handle "more" button for bio expansion
          const moreButton = await page.locator('[data-e2e="user-bio"] .css-oq7mmz-DivBioMore');
         
          if (await moreButton.isVisible()) {
            await moreButton.click();
    
            // Wait for the popover to appear
            const popoverSelector = '.TUXPopover-popover';
            await page.waitForSelector(popoverSelector, { timeout: 5000 });
    
            // Extract expanded bio from the popover
            const expandedBio = await page
              .locator(`${popoverSelector} h2`)
              .textContent()
              .catch(() => null);
    
            data.bio = expandedBio?.trim() || data.bio; // Use expanded bio if available
          } else {
            // Fallback to basic bio extraction if "more" button is not present
            const basicBio = await page.locator('[data-e2e="user-bio"] .css-lesntn-DivBioText').textContent().catch(() => null);
            data.bio = basicBio?.trim() || null;
          }
        

          const userDataObject={ profileLink: link, ...data}

          const query = `
          INSERT INTO profiles(name,bio,profileLink)
          VALUES (?, ?,?)
          ON DUPLICATE KEY UPDATE bio = VALUES(bio);`;


        await connection.execute(query, [userDataObject.userTitle, userDataObject.bio ? userDataObject.bio : null ,userDataObject.profileLink ? userDataObject.profileLink : null]);


          // Add data to the  array
          userData.push(userDataObject);
   

        } catch (error) {
          console.error(`Failed to extract data for ${link}:`, error);
          await page.screenshot({ path: `error-${link.split('@')[1]}.png` }); // Capture screenshot for debugging
        }

        await page.waitForTimeout(5000)

      }

      console.log(userData)

    



    // Perform further actions as needed

    // Close the browser
    //await browser.close();
})();
