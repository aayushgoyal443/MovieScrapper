const axios = require('axios');
const cheerio = require("cheerio");
const fs = require("fs");
const { parse } = require('path');

const getTitle = (title) => {
	const kr_title = title.replace(/\(.*\)\s*/, "");
	// console.log(kr_title);
	return kr_title;
};

const trailerFinder = async (trailerList) => {
	const result = trailerList.filter((trailer) => {
		let temp = trailer["Title"].indexOf("메인") !== -1;
		if (!temp) {
			temp = trailer["Title"].indexOf("예고편") !== -1;
		}
		return temp;
	});
	return result;
};

const getMovieInfo = async ($, movieIdx) => {
	const mvInfodata = {
		_id: "", // 영화 id
		contentOrgName: "",
		contentKrName: "",
		mediaType: "movie",
		runTime: 0,
		posterURL: "",
		trailerURL: "",
		ageLimit: "",
		synopsis: "",
		imdbScore: 0,
		tmdbScore: 0,
		cinemaScore: 0,
		seasonCount: 0,
		genres: [],
		offers: [],
		releaseDate: "",
		bookingRate: 0,
		companyID: 1,
	};
	var synopsis = $("#menu > div.col-detail > div.sect-story-movie")
		.text()
		.trim(); // 개요
	var mvName = $(
		"#select_main > div.sect-base-movie > div.box-contents > div.title > strong"
	).text();
	var mvOrgName = $(
		"#select_main > div.sect-base-movie > div.box-contents > div.title > p"
	).text();
	var s = $("#select_main > div.sect-base-movie > div.box-contents > div.spec")
		.text()
		.replace(/[^ㄱ-힣a-zA-Z:,/0-9]/gi, "")
		.replace("장르:", "/")
		.split("/");
	if (s[s.length - 1] === "") s.pop();
	var genreList = s[s.length - 2].split(",");
	let age = "";
	switch (
	s[s.length - 1].replace("기본:", "").replace("개봉:", ",").split(",")[0]
	) {
		case "전체":
			age = "00";
			break;
		case "12세이상":
			age = "12";
			break;
		case "15세이상":
			age = "15";
			break;
		default:
			age = "18";
			break;
	}
	//
	const extraInfo_tmp = s[s.length - 1]
		? s[s.length - 1].replace("기본:", "").replace("개봉:", ",").split(",")[1]
		: "";
	var extraInfo = s[s.length - 1]
		? [
			age,
			extraInfo_tmp ? extraInfo_tmp.replace(/[^0-9]/gi, "") : "",
			// s[s.length - 1]
			//   .replace("기본:", "")
			//   .replace("개봉:", ",")
			//   .split(",")[2],
		]
		: ["", "", ""];
	// 관람가, 런타임, 제작국가.
	var releaseDate = $(
		"#select_main > div.sect-base-movie > div.box-contents > div.spec > dl > dd:nth-child(11)"
	)
		.text()
		.replace(/[^0-9]/gi, "");
	var movieID = $(
		"#select_main > div.sect-base-movie > div.box-contents > span.like > a.link-reservation"
	)
		.attr("href")
		.replace(/[^0-9]/gi, "")
		.slice(0, 8);
	var poster = $("#select_main > div.sect-base-movie > div.box-image > a").attr(
		"href"
	);
	var stillCut = $(
		"#still_motion > div.item-wrap:nth-child(4) > div.item > img"
	).attr("data-src");
	var bookingRate = $(
		"#select_main > div.sect-base-movie > div.box-contents > div.score > strong > span"
	).text();
	var vote_avg = String(
		$(
			"#select_main > div.sect-base-movie > div.box-contents > div.score > div > span.percent"
		)
			.text()
			.replace("%", "") / 10
	);
	const forTrailerurl =
		"http://www.cgv.co.kr/common/ajax/movies.aspx/GetHDTrailerRelationMovieTopList?movieIdx=" +
		movieIdx +
		"&outGalleryIdx=000000&limitCount=1000";
	await axios
		.get(forTrailerurl, { headers: { "Content-Type": "application/json" } })
		.then(async (res) => {
			const trailerList = JSON.parse(res.data.d);
			const trailerInfo = await trailerFinder(trailerList);
			//////////////////////////////////////작업 영역//////////////////////////////////////
			mvInfodata._id = movieIdx;
			mvInfodata.contentKrName = getTitle(mvName);
			mvInfodata.contentOrgName = mvOrgName;
			mvInfodata.runTime = extraInfo[1];
			mvInfodata.posterURL = poster;
			mvInfodata.trailerURL = trailerInfo[0] ? trailerInfo[0].FlashUrl : "";
			mvInfodata.ageLimit = extraInfo[0];
			mvInfodata.synopsis = synopsis;
			mvInfodata.cinemaScore = isNaN(vote_avg) ? 0 : vote_avg;
			mvInfodata.genres = genreList;
			mvInfodata.releaseDate = releaseDate;
			mvInfodata.bookingRate = bookingRate.slice(0, -1);
			//////////////////////////////////////대입 완료//////////////////////////////////////
		});
	// console.log(mvInfodata.movieName);
	return mvInfodata;
};

(async () => {

	id_arr = [];	// this contains all the Movie Indexes

	var url1 = "http://www.cgv.co.kr/movies";
	await axios
		.get(url1, { "Content-Type": "application/json" })
		.then(async (res) => {
			const $ = cheerio.load(res.data);
			// console.log($("#contents > div.wrap-movie-chart > div.sect-movie-chart > ol"));
			$("#contents > div.wrap-movie-chart > div.sect-movie-chart > ol").map(
				(i, elem) => {
					// console.log(i);
					$(elem)
						.find("li")
						.map((j, damta) => {
							if ($(damta).find("div > a").attr("href")) {
								id_arr.push(parseInt($(damta).find("div > a").attr("href").replace(/[^0-9]/gi, "")));
							}
						});
				}
			);
		});


	const url2 = "http://www.cgv.co.kr/common/ajax/movies.aspx/GetMovieMoreList?listType=1&orderType=1&filterType=1";
	await axios
		.get(url2, { headers: { "Content-Type": "application/json" } })
		.then(async (res) => {
			const data = JSON.parse(res.data.d);
			data.List.map((movie, i) => {
				// console.log(movie.MovieIdx);
				id_arr.push(movie.MovieIdx);
			});
		});

	const defaultURL = "http://m.cgv.co.kr/WebAPP/MovieV4/ajaxMovie.aspx";
	const pageRow = 20;
	const mtype = "now";
	const morder = "TicketRate";
	const mnowflag = 0;
	const flag = "MLIST";

	for (let iPage = 1; iPage <= 6; iPage++) {
		await axios
			.get(defaultURL, {
				params: {
					iPage,
					pageRow,
					mtype,
					morder,
					mnowflag,
					flag,
				},
			})
			.then(({ data }) => {
				const pattern = /MovieIdx=(\d+)/g;
				let arr = data.match(pattern);
				arr = arr
					? arr.map((str) => {
						return str.replace("MovieIdx=", "");
					})
					: [];
				for (let z=0;z< arr.length;z++){
					id_arr.push(parseInt(arr[z]));
				}
			});
	}
	var c1  = id_arr.length;
	var movie_set = new Set(id_arr);
	id_arr = Array.from(movie_set);
	var c2 = id_arr.length;

	// console.log(c1, c2);

	// console.log("Movie indexes extracted");
	// console.log(id_arr);

	const cgv_list = await Promise.all(
		id_arr.map(async (id, i) => {
			// if (i==1) return;
			const url = "http://www.cgv.co.kr/movies/detail-view/?midx=" + id;
			return axios.get(url).then(({ data }) => {
				const $ = cheerio.load(data);
				return getMovieInfo($, id);
			});
		})
	);

	console.log(cgv_list);


})();
