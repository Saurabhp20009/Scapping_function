
async function navigateFacebookWithCookies(keyword, records) {

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    const connection = await getDatabaseConnection();  // Get database connection


    try {

        const cookies = await fs.promises.readFile('facebook_cookies.json', 'utf8').then(JSON.parse).catch(() => []);
        await context.addCookies(cookies);


        await page.goto('https://www.facebook.com');

        await page.fill('input[aria-label="Search Facebook"]', keyword);
        await page.press('input[aria-label="Search Facebook"]', 'Enter');

        // Wait for the search results to stabilize using specific class names
        const resultSelector = '.x9f619.x1n2onr6.x1ja2u2z';  // Combine classes with dots as they need to be in the same element
        await page.waitForSelector(resultSelector, {
            timeout: 10000  // Adjust the timeout based on expected load times
        });


        // Scroll the page several times to load more content
        for (let i = 0; i < 2; i++) {  // Change the number of scrolls as needed
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);  // Wait a bit for the next batch of content to load
        }

        await page.waitForTimeout(10000)


        const urls = await page.$$eval('a[attributionsrc*="/privacy_sandbox/comet/register/source/"]', (links, maxRecords) => {
            // Filter and map links that specifically match the required URL patterns
            return links.filter(link =>
                !link.href.startsWith('https://l.facebook.com/l.php') &&
                (link.href.includes('profile.php?id='))   || link.href.match(/facebook\.com\/[\w\.]+[\?&]/)
            ).map(link => new URL(link.href).href)  // Normalize URLs to remove any session-specific parameters
                .slice(0, maxRecords);

        }, records);



        console.log(urls)







        const profileFullData = [];

        for (const link of urls) {
            console.log(`Navigating to URL: ${link}`);
            await page.goto(link);

            await page.waitForTimeout(5000)




            const urlRegex = /facebook\.com\/profile\.php\?id=\d+.*&__cft__\[\d+\]=.*/;






            // // Wait for the navigation bar to load and click on the 'About' section
            // const aboutSelector = 'a[href*="=about"]'; // Targets links that contain 'about' in their href attribute
            // await page.waitForSelector(aboutSelector, { state: "visible" }); // Ensure the element is visible
            // await page.click(aboutSelector); // Click on the 'About' link
            // console.log("about was clicked");

            // Wait for the links to be available on the page
            await page.waitForSelector('a[href*="=about"], a[href*="/about"]');

            // Collect all links matching the updated selector
            const aboutLinks = await page.$$('a[href*="=about"], a[href*="/about"]');

            // Loop through each link and click on it
            for (let link of aboutLinks) {
                if (await link.isVisible()) {
                    await link.click();
                    

                }
            }

            // Wait for the 'About' content to load and extract required details
            const categoriesSelector = ".xyamay9.xqmdsaz.x1gan7if.x1swvt13"; // Adjust selector as needed
            await page.waitForSelector(categoriesSelector, { state: "visible" });

            // Extract 'Categories' and 'Contact info'
            const categoriesContent = await page.$$eval(
                categoriesSelector,
                (nodes) => nodes.map((node) => node.textContent)
            );
            const contactInfoSelector = ".xat24cr"; // Use specific selectors that uniquely identify these elements
            const contactInfoContent = await page.$$eval(
                contactInfoSelector,
                (nodes) => nodes.map((node) => node.textContent)
            );

            const aboutDetails = {
                categories: categoriesContent.join(" | "), // Concatenate all categories, if more than one
                contactInfo: contactInfoContent.join(" | "), // Concatenate all contact info, if more than one
            };

            console.log(`Profile Link: ${link}`);
            console.log("About Details:", aboutDetails);

            // Insert data into MySQL database
            const query = `
             INSERT INTO profile_details (profile_link, contact_info)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE contact_info = VALUES(contact_info);
         `;
            await connection.execute(query, [link, `${aboutDetails.categories} | ${aboutDetails.contactInfo}`]);

            profileFullData.push({
                link: link,
                about: aboutDetails,
            });

            await page.waitForTimeout(10000); // Delay to avoid rate limits or to simulate user browsing
        }

        console.log("last", profileFullData)

        await browser.close();




    } catch (error) {
        console.error('Error during scraping:', error);
        await browser.close();
        throw error;
    }



}
