(async () => {
    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized'],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const connection = await getDatabaseConnection()

    await reloginUsingCookies(context, page);


    // await page.goto('https://www.reddit.com/login/', { waitUntil: 'networkidle' });


    // Wait for navigation or other post-login confirmation

    // Wait for login to complete

    console.log('Login successful! Now searching...');



    // Wait for the search bar to be visible

    const searchBar = page.locator('input[placeholder="Search Reddit"]').nth(0); // Adjust index based on log output

    console.log("searchBar", searchBar)




    console.log('Resolved searchBar HTML:', await searchBar.evaluate(el => el.outerHTML));

    await searchBar.waitFor({ state: 'visible' });
    await searchBar.focus();
    console.log('Search bar is visible and focused');

    const cookies = await context.cookies();
    await fs.writeFile("reddit_cookies.json", JSON.stringify(cookies, null, 2));

    console.log("Cookies saved successfully.");

    //await page.waitForNavigation({waitUntil:'networkidle'})



    // Mimic human typing in the search bar
    const searchQuery = 'food';
    await searchBar.type(searchQuery, { delay: 100 }); // 100 ms delay between keystrokes
    console.log(`Typed query: ${searchQuery}`);

    // Optionally, press Enter to execute the search
    await searchBar.press('Enter');

    // Wait for search results to load
    //await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Wait for the search results to load
    await page.waitForSelector('div[data-testid="search-post-unit"]', { timeout: 10000 });
    console.log('Search results loaded.');


    await page.waitForTimeout(3000);

    // Locate all post containers
    const posts = await page.locator('div[data-testid="search-post-unit"]');
    console.log(posts)

    // Create an array to store post details
    const postDetailsArray = [];

    // Use `forEach` to loop through posts
    const postHandles = await posts.elementHandles(); // Get individual element handles
    postHandles.forEach(async (post, index) => {
        try {
            // Extract post details
            // const profileName = await post.$eval('a[href^="/r/"]', el => el.innerText).catch(() => 'No profile name');
            // const postTitle = await post.$eval('a[data-testid="post-title-text"]', el => el.innerText).catch(() => 'No title');
            // const votes = await post.$eval('faceplate-number:first-of-type', el => el.innerText).catch(() => 'No votes');
            // const comments = await post.$eval('faceplate-number:nth-of-type(2)', el => el.innerText).catch(() => 'No comments');

            // // Create an object for the current post
            // const postObject = {
            //     profileName,
            //     postTitle,
            //     votes,
            //     comments,
            // };

            const profileLink = await post.$eval('a[href^="/r/"]', el => el.href).catch(() => 'No profile link');

            postDetailsArray.push(profileLink)

            // Push the object into the array
            //postDetailsArray.push(postObject);

            //console.log(`Post ${index + 1} extracted:`, postObject);
        } catch (error) {
            console.warn(`Failed to extract details for post ${index + 1}:`, error);
        }
    });

    // Wait to ensure all promises in `forEach` complete
    await page.waitForTimeout(5000);

    // Log the complete array of post details
    console.log('Extracted Post Details:', postDetailsArray);


    const profileFullDetailsArray = [];

    for (const link of postDetailsArray) {
        try {
            console.log(`Navigating to: ${link}`);
            await page.goto(link);
            await page.waitForTimeout(2000); // Pause to allow profile page to load

            // Extract details
            const profileName = await page.locator('shreddit-subreddit-header').getAttribute('prefixed-name').catch(() => 'No profile name');
            const displayName = await page.locator('shreddit-subreddit-header').getAttribute('display-name').catch(() => 'No display name');
            const description = await page.locator('shreddit-subreddit-header').getAttribute('description').catch(() => 'No description');
            const subscribers = await page.locator('shreddit-subreddit-header').getAttribute('subscribers').catch(() => 'No subscribers');
            const activeMembers = await page.locator('shreddit-subreddit-header').getAttribute('active').catch(() => 'No active members');

            const createdDate = await page.locator('faceplate-tooltip:has-text("Created") time').getAttribute('datetime').catch(() => 'No created date');
            const communityVisibility = await page.locator('faceplate-tooltip:has-text("Public")').innerText().catch(() => 'No visibility info');

            // Store details in an object
            const Details = {
                profileLink: link,
                profileName,
                displayName,
                description,
                subscribers,
                activeMembers,
                createdDate,
                communityVisibility,
            };


            const query = `
              INSERT INTO profiles(Name,Description)
              VALUES (?, ?)
              ON DUPLICATE KEY UPDATE Description = VALUES(Description);`;


            await connection.execute(query, [displayName, description ? description : null]);

            profileFullDetailsArray.push(Details);
            console.log('Extracted Profile Details:', Details);
        } catch (error) {
            console.warn(`Failed to extract details for profile at ${link}:`, error);
        }
    }

    fs.writeFile('reddit_leads.json', JSON.stringify(profileFullDetailsArray, null, 4), 'utf8', err => {
        if (err) {
            console.error('Failed to save profile data to file:', err);
        } else {
            console.log('All profile data saved to profileInfo.json');
        }
    });



    console.log('Search completed.');

    //await browser.close();
})();
