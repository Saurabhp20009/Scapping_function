async function navigateWithCookies(url) {
  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36",
  });

  const page = await context.newPage();

  const connection =  await getDatabaseConnection()

  // Load cookies from file
  try {
    const cookies = JSON.parse(
      await fs.readFile("twitter_cookies.json", "utf8")
    );
    await context.addCookies(cookies);
    console.log("Cookies loaded successfully.");
  } catch (error) {
    console.error("Failed to load cookies:", error);
    return; // Exit if cookies can't be loaded
  }

  // Navigate to the URL
  await page.goto(url);
  console.log(`Navigated to ${url}.`);

  // Optional: Perform operations on the page

  // Wait to observe or handle the page
  await page.waitForTimeout(5000); // Wait for 5 seconds to observe the page

  // Find the search input box and type the search query
  const searchSelector = 'input[data-testid="SearchBox_Search_Input"]';
  await page.waitForSelector(searchSelector, { state: "visible" });

  query = "online business";

  console.log("Typing search query...");
  for (let char of query) {
    await page.type(searchSelector, char, { delay: Math.random() * 100 + 50 });
  }

  // Optionally, simulate pressing Enter to execute the search
  await page.press(searchSelector, "Enter");

  const cookies = await context.cookies();
  await fs.writeFile("twitter_cookies.json", JSON.stringify(cookies, null, 2));

  console.log("Cookies saved successfully.");

  console.log("Search executed. Check the browser for results.");

  // Wait for the navigation bar to be visible
  await page.waitForSelector('nav[role="navigation"]');

  // Click on the "People" link in the navigation bar
  await page.click('div[role="tablist"] >> text=People');

  // Additional actions after clicking the "People" tab
  console.log('Navigated to the People tab.');


  // // Wait for the tweets to load
  // await page.waitForSelector('article[data-testid="tweet"]');

  // // Extract details from the tweets
  // const tweetData = await page.$$eval(
  //   'article[data-testid="tweet"]',
  //   (tweets) =>
  //     tweets.map((tweet) => {
  //       // const profileName = tweet.querySelector('[data-testid="User-Name"]')
  //       //   ?.textContent;
  //       // const userHandle = tweet.querySelector('div[dir="ltr"] > a')
  //       //   ?.textContent;
  //       // const timestamp = tweet.querySelector("time")?.getAttribute("datetime");
  //       // const tweetContent = tweet.querySelector('[data-testid="tweetText"]')
  //       //   ?.textContent;
  //       //return { profileName, userHandle, timestamp, tweetContent };
  //      return tweet
  //     })
  // );

  // console.log(tweetData);



  // Wait for the people list to load
  await page.waitForTimeout(3000);

  const profileLinks = await page.$$eval('a[aria-hidden="true"]', links =>
    links.map(link => link.href.startsWith('http') ? link.href : `https://x.com${link.getAttribute('href')}`)
  );
 
 console.log(profileLinks)


 let profileLinkData = [];

 

  // Iterate through each profile URL to extract details
  for (const profileLink of profileLinks) {
    await page.goto(profileLink);
  
    await page.waitForTimeout(3000)

    var profileDetails = await page.evaluate(() => {
      const displayName = document.querySelector('div[data-testid="UserName"]')?.textContent.trim();
      const bio = document.querySelector('[data-testid="UserDescription"]')?.textContent.trim();
      const website = document.querySelector('[data-testid="UserUrl"] a')?.href;

     
      return { displayName, bio, website };
    });
    //console.log(profileDetails);
   

   
    const query = `
                    INSERT INTO profiles(Name,Bio)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE Bio = VALUES(Bio);
                `;
 

    await connection.execute(query, [profileDetails.displayName , profileDetails.bio ? profileDetails.bio : null]);            
    profileLinkData.push(profileDetails)

    await page.waitForTimeout(3000)



  }

  console.log(profileLinkData)

  
  fs.writeFile('twitter_leads.json', JSON.stringify(profileLinkData, null, 4), 'utf8', err => {
    if (err) {
        console.error('Failed to save profile data to file:', err);
    } else {
        console.log('All profile data saved to profileInfo.json');
    }
});




  // Close the browser (optional)
  //await browser.close();
}
