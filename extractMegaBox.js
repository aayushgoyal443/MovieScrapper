const axios = require("axios");
const cheerio = require("cheerio");
const { htmlToText } = require("html-to-text");


const getAgeLimit = name => {
	if (name === null || name === false) {
		return "";
	}
	name = name.slice(0, 2);
	if (name === "전체") return "00";
	else if (name === "청소") return "18";
	else if (name === "등급") return "미정";
	else return name;
};

// 트레일러를 받아오는 함수
const getTrailer = async movie => {
	const url =
		"https://www.megabox.co.kr/on/oh/oha/Movie/selectMovieStilDetail.do";

	// post 요청을 하면 html 형식으로 값을 반환해줘서, selector로 내용을 찾는 방식을 택했다.(cheerio 이용)
	const trailer = await axios
		.post(url, {
			rpstMovieNo: movie,
		})
		.then(data => {
			const $ = cheerio.load(data.data);
			const video = $("#videoTag > source").attr("src");
			return video;
		});

	return trailer;
};


// 뒷 배경을 받아오는 함수
const getBackdropPath = async movie => {
	const url = `https://www.megabox.co.kr/movie-detail?rpstMovieNo=${movie}`;

	// selector를 통해 데이터를 찾는 방식을 사용했다.(cheerio 이용)
	const backdrop = await axios.get(url).then(data => {
		const $ = cheerio.load(data.data);
		const img = $("#contents > div.movie-detail-page > div.bg-img").attr(
			"style"
		);

		const pattern = /\('(.*)'\)/;
		const result = pattern.exec(img);
		if (result.length > 1) return result[1];
		else return "";
	});
	return backdrop;
};

// 한국어 제목을 반환하는 함수
const getTitle = title => {
	const kr_title = htmlToText(title.replace(/\[.*\]\s*/, ""));

	return kr_title;
};

// 영어 제목을 반환하는 함수
const getEngTitle = async movie => {
	const url = `https://www.megabox.co.kr/movie-detail?rpstMovieNo=${movie}`;

	// selector를 통해 데이터를 찾는 방식을 사용했다.(cheerio 이용)
	const engTitle = await axios.get(url).then(data => {
		const $ = cheerio.load(data.data);
		const title = $(
			"#contents > div.movie-detail-page > div.movie-detail-cont > p.title-eng"
		);

		return title.text();
	});
	return engTitle;
};


// 시놉시스 데이터를 반환하는 함수
const getSynopsis = async movie => {
	const url = `https://www.megabox.co.kr/movie-detail?rpstMovieNo=${movie}`;
	const synopsis = await axios.get(url).then(data => {
		const $ = cheerio.load(data.data);
		const syp = $("#movieSynopCn").attr("value");
		return syp.replace(/.*\[시놉시스\]/, "");
	});
	// console.log(synopsis.replace(/\[.*/, ""));
	return synopsis.replace(/\[.*/, "");
};

// 장르를 반환해주는 함수(배열 형식)
const getGenres = async movie => {
	const url = "https://www.megabox.co.kr/on/oh/oha/Movie/selectMovieInfo.do";

	const genres = await axios
		.post(url, {
			rpstMovieNo: movie,
		})
		.then(data => {
			// selector를 통해 데이터를 찾는 방식을 사용했다.(cheerio 이용)

			const pattern = /장르\s+:\s(.*)\s\//;
			const $ = cheerio.load(data.data);
			const txt = $(".line > p").text();
			const result = pattern.exec(txt);

			if (result === null) return [];
			if (result.length > 1) return result[1].split(",");
			else return [];
		});

	return genres;
};



(async () => {

	const url = "https://www.megabox.co.kr/on/oh/oha/Movie/selectMovieList.do";

	const dic = {
		currentPage: "1",
		ibxMovieNmSearch: "",
		onairYn: "N",
		pageType: "ticketing",
		recordCountPerPage: "200", // 영화 정보를 200개까지 받아오도록 지정함, 현재 상영작이 200개가 넘으면 더 늘리겠음
		specialType: "",
	};

	const headers = {
		Accept: "application/json",
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36",
	};

	var opts = {
		url: url,
		method: "POST",
		data: dic,
		headers: headers,
		contentType: "application/json",
	};

	// 최종 영화 상세 정보를 저장하는 배열
	const movie_list = [];

	// 영화 리스트를 받아온다.
	const movies = await axios(opts)
		.then(data => {
			return data.data.movieList;
		})
		.catch(console.log);


	// 긱 영화마다 상세 정보를 정한 형식대로 변형하여 저장한다.
	const promise = await Promise.all(
		movies.map(async movie => {
			let trailer = await getTrailer(movie.movieNo).catch(1); // 트레일러를 가져온다.
			let backdrop = await getBackdropPath(movie.movieNo).catch(2); // 뒷 배경을 가져온다.
			const engTitle = await getEngTitle(movie.movieNo).catch(3); // 영어 제목을 가져온다.
			const genres = await getGenres(movie.movieNo).catch(4); // 장르를 가져온다.
			const synopsis = await getSynopsis(movie.movieNo).catch(5);
			const vote_average = movie.totalSpoint ? movie.totalSpoint : 0; // 평점을 가져온다.

			// backdrop 이나 trailer 의 정보가 없다면 빈 문자열을 저장해준다.
			if (backdrop === undefined) backdrop = "";
			if (trailer === undefined) trailer = "";

			const tmp = {
				_id: movie.rpstMovieNo, // 고유 ID
				contentKrName: getTitle(movie.movieNm), // 영화 제목(한국어)
				contentOrgName: engTitle, // 영화 제목(영어)
				mediaType: "movie",
				runTime: movie.playTime, // 런타임
				posterURL: "https://img.megabox.co.kr" + movie.imgPathNm, // 포스터
				trailerURL: trailer, // 트레일러
				ageLimit: getAgeLimit(movie.admisClassNm), // 나이 제한
				synopsis: htmlToText(htmlToText(synopsis)), // 시놉시스
				imdbScore: 0,
				tmdbScore: 0,
				companyID: 3,
				cinemaScore: vote_average,
				seasonCount: 0,
				genres: genres, // 장르
				offers: [],
				release_date: movie.rfilmDeReal, // 개봉일
				bookingRate: movie.boxoBokdRt, // 예매율
			};

			movie_list.push(tmp);
		})
	);

	console.log( "No. of movies are:", movie_list.length);
	for (let i=0;i< movie_list.length;i++){
		console.log(movie_list[i]);
	}



})();