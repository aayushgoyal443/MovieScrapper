const axios = require("axios");
const {htmlToText} = require("html-to-text");
// 롯데시네마의 영화 상세 정보를 불러오는 코드

// 나이 제한 정한 형식에 맞춰주는 함수
const getAgeLimit = (name) => {
	if (name === null || name === false) {
		// console.log("엥 연령제한 없는거 있네?");
		return "";
	}
	name = name.slice(0, 2);
	if (name === "전체") return "00";
	else if (name === "청소") return "18";
	else return name;
};

// 개봉일 반환해주는 함수
const getReleaseDate = (date) => {
	if (date === null || date === false) {
		return "";
	} else return date.slice(0, 10);
};


// 장르를 배열형태로 반환해주는 함수
const getGenres = (genres) => {
	const genre_list = [];
	if (genres.MovieGenreNameKR !== "") genre_list.push(genres.MovieGenreNameKR);
	if (genres.MovieGenreNameKR2 !== "")
		genre_list.push(genres.MovieGenreNameKR2);
	if (genres.MovieGenreNameKR3 !== "")
		genre_list.push(genres.MovieGenreNameKR3);

	return genre_list;
};

//현재 상영작 영화 정보를 가져오는 함수
const getMovie = async () => {
	const url = "https://www.lottecinema.co.kr/LCWS/Movie/MovieData.aspx";

	const dic = {
		MethodName: "GetMoviesToBe",
		channelType: "HO",
		osType: "Chrome",
		osVersion:
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36",
		multiLanguageID: "KR",
		division: 1,
		moviePlayYN: "Y", // 이부분 N 으로 바꿔서도 받아야한다. (현재 상영중인지 아닌지 나타내는 변수)
		orderType: 1,
		blockSize: 100,
		pageNo: 1,
		memberOnNo: "",
	};

	// axios 를 이용해 JSON 형식으로 정보를 받아온 뒤, 영화 아이디만 리턴해준다.
	// 현재 상영작 영화 아이디 가져오기
	const nowShowingMovies = await axios
		.post(url, "ParamList=" + JSON.stringify(dic))
		.then((data) => {
			const info = [];
			data.data.Movies.Items.map((movie) => {
				info.push(movie.RepresentationMovieCode);
			});
			return info;
		});

	// 상영 예정작 영화 아이디를 가져오기 위해서 moviePlayYN 을 N 으로 바꿔준다.
	dic.moviePlayYN = "N";

	// 상영 예정작 영화 아이디 가져오기
	const comingSoonMovies = await axios
		.post(url, "ParamList=" + JSON.stringify(dic))
		.then((data) => {
			const info = [];
			data.data.Movies.Items.map((movie) => {
				info.push(movie.RepresentationMovieCode);
			});
			return info;
		});

	return [...nowShowingMovies, ...comingSoonMovies];
};

(async () => {


	// 영화 상세정보를 반환하는 url
	const url = "https://www.lottecinema.co.kr/LCWS/Movie/MovieData.aspx";

	// 현재 상영중인 영화들의 아이디를 가져온다.
	const movieIDs = await getMovie().catch(console.log);

	// console.log("Extracted the movie names...");
	// console.log(movieIDs);

	// console.log("Starting to extract the information related to the movies...");

	const movieDetails = [];

	const promise = await Promise.all(
		movieIDs.map(async (movieID) => {
			// console.log(movieID);
			const dic = {
				MethodName: "GetMovieDetailTOBE",
				channelType: "HO",
				osType: "Chrome",
				osVersion:
					"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36",
				multiLanguageID: "KR",
				representationMovieCode: movieID,
				memberOnNo: "",
			};
			// post 방식으로 영화 상세정보를 불러온다.
			const movieDetail = await axios
				.post(url, "ParamList=" + JSON.stringify(dic))
				.then(({ data }) => {
					
					const movie_info = data.Movie;
					// console.log(movie_info);

					// 트레일러 중, 메인 트레일러를 받아온다. 메인 트레일러가 없다면 다른 트레일러를 받아오도록 만들었다.
					// 트레일러가 없는 경우는 "" 을 반환하도록 했다.
					// backdrop path 에 데이터를 넣기위해 trailer 의 초기 이미지를 받아온다.
					// console.log(data.Trailer.Items);

					const trailer_infos = data.Trailer.Items.filter((trailer) => {
						if ( trailer.ImageDivisionCode == 2 && trailer.MediaTitle.includes("예고편") )
							return true;
					});
					let trailer_info = {};
					if (trailer_infos.length !== 0) {
						trailer_info = trailer_infos.find((trailer) => {
							return trailer.MediaTitle.includes("메인");
						});
						trailer_info = trailer_info ? trailer_info : trailer_infos[0];
					} else {
						trailer_info = { ImageURL: "", MediaURL: "" };
					}

					// tmp 의 object 에 정한 형식대로 데이터를 넣는다.
					const tmp = {
						_id: movieID, // 영화 고유 ID (대표 ID)
						contentKrName: movie_info.MakingNationNameKR, // 영화 이름
						contentOrgName: movie_info.MakingNationNameUS, // 영화 영어 이름(original 데이터가 없어 일단 영어로 받아왔다.)
						mediaType: "movie",
						runTime: movie_info.PlayTime, // 상영시간
						posterURL: movie_info.PosterURL, // 포스터 이미지
						trailerURL: trailer_info.MediaURL, // 트레일러
						ageLimit: getAgeLimit(movie_info.ViewGradeNameKR), // 연령 제한
						synopsis: htmlToText(movie_info.SynopsisKR), // 시놉시스
						imdbScore: 0,
						tmdbScore: 0,
						companyID: 2,
						cinemaScore: movie_info.ViewEvaluation
							? movie_info.ViewEvaluation
							: 0,
						seasonCount: 0,
						genres: getGenres(movie_info), // 장르 (배열)
						offers: [],
						releaseDate: getReleaseDate(movie_info.ReleaseDate), // 개봉일
						bookingRate: movie_info.BookingRate,
					};
					return tmp;
				})
				.catch(console.log);
			// 영화 ID 가 AD 인 경우가 있는데 이는 더미 데이터이므로 제외하고 넣어준다.
			if (movieDetail._id !== "AD") movieDetails.push(movieDetail);
		})
	);

	movieDetails.forEach(mv => {
		console.log(mv);
	});
	// console.log("Movie details extraction also complete...");

})();