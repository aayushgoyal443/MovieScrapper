const axios = require('axios');
const cheerio = require("cheerio");
const fs = require("fs");

(async () => {
	var url1 = "http://www.cgv.co.kr/movies";
	await axios
		.get(url1, { "Content-Type": "application/json" })
		.then(async (res) => {
			const $ = cheerio.load(res.data);
			// console.log($("#contents > div.wrap-movie-chart > div.sect-movie-chart > ol"));
			$("#contents > div.wrap-movie-chart > div.sect-movie-chart > ol").map(
				(i, elem) => {
					console.log(i);
					$(elem)
						.find("li")
						.map((j, damta) => {
							if ($(damta).find("div > a").attr("href")) {
								console.log({
									movieIdx: String(
										$(damta)
											.find("div > a")
											.attr("href")
											.replace(/[^0-9]/gi, "")
									),
								});
							}
						});
				}
			);
		});


	const url2 = "http://www.cgv.co.kr/common/ajax/movies.aspx/GetMovieMoreList?listType=1&orderType=1&filterType=1";
	axios
		.get(url2, { headers: { "Content-Type": "application/json" } })
		.then(async (res) => {
			const data = JSON.parse(res.data.d);
			data.List.map((movie, i) => {
				console.log({ movieIdx: String(movie.MovieIdx) });
			});
		});

})();
