var sctr = sctr || {};

sctr.MAPQUEST_API_KEY = "Of0SZNgA3cYSkg57vu6OdZcnSLF9ePeE";

sctr.FB_COLLECTION_USERS = "Users";
sctr.FB_COLLECTION_DOGS = "Dogs";

sctr.FB_KEY_AUTH_ID = "uid";
sctr.FB_KEY_EMAIL = "email";
sctr.FB_KEY_FIRSTNAME = "firstName";
sctr.FB_KEY_LASTNAME = "lastName";
sctr.FB_KEY_LOCATIONLATLNG = "locationLatLng";
sctr.FB_KEY_LOCATION = "location";
sctr.FB_KEY_PHOTOURL = "photoUrl";

sctr.FB_KEY_DOG_OWNER = "owner";
sctr.FB_KEY_DOG_OWNERUUID = "ownerUUID";
sctr.FB_KEY_DOG_NAME = "name";
sctr.FB_KEY_DOG_BREED = "breed";
sctr.FB_KEY_DOG_DESCRIPTION = "description";
sctr.FB_KEY_DOG_LOSTLOCATION = "lostLocation";
sctr.FB_KEY_DOG_LOSTLOCATIONLATLNG = "lostLocationLatLng";
sctr.FB_KEY_DOG_ISMISSING = "isMissing";
sctr.FB_KEY_DOG_PHOTOURL = "photoUrl";

sctr.DEFAULT_SEARCH_RADIUS_MILES = 30;

sctr.addingUserToDatabase = false;

function htmlToElement(html) {
	var template = document.createElement('template');
	html = html.trim();
	template.innerHTML = html;
	return template.content.firstChild;
}

sctr.HomePageController = class {
	constructor() {
		this.searchRadius = sctr.milesToMeters(sctr.DEFAULT_SEARCH_RADIUS_MILES);
		sctr.initDrawer();
		sctr.fbDogsManager.beginListening(false, this.updateDogList.bind(this));
		sctr.fbUsersManager.addUserChangeCallback(this.updateView.bind(this));

		$("#lostCheckbox").on("change", (event) => {
			this.updateDogList();
		});

		$("#searchRadius").on("change", (event) => {
			this.searchRadius = sctr.milesToMeters($("#searchRadius").val());
			this.updateDogList();
		});

		$("#searchDog").on("change", (event) => {
			$("#searchRadius").prop("disabled", !!event.target.value);

			sctr.fbDogsManager.stopListening();
			sctr.fbDogsManager.setQuery($("#searchDog").val());
			sctr.fbDogsManager.beginListening(false, this.updateDogList.bind(this));
		});
	}

	updateView() {
		const user = sctr.fbUsersManager.currentUser;
		$("#drawerProfileName").text(`${user.firstName} ${user.lastName}`);
		$("#drawerProfileEmail").text(user.email);
		if(user.photoUrl) {
			$("#drawerProfileImage").attr("src", user.photoUrl);
		}
		this.updateDogList();
	}

	updateDogList() {
		const newList = htmlToElement('<div id="dogListContainer"></div>');
		const lostDogsOnly = $("#lostCheckbox").prop("checked");

		for(let i = 0; i < sctr.fbDogsManager.length; i++) {
			const dog = sctr.fbDogsManager.getDogAtIndex(i);
			const newCard = this.createDogCard(dog);

			if(lostDogsOnly && !dog.isMissing) {
				continue;
			}

			dog.owner.get().then((o) => {
				let owner = sctr.fbUsersManager.userObjectFromReference(o);
				console.log(owner);
				let dogLocation;

				if(dog.isMissing) {
					dogLocation = dog.lostLocationLatLng;
					console.log("OK");
				} else {
					dogLocation = owner.locationLatLng;
				}

				let dist = sctr.distanceBetweenGeopoints(dogLocation, sctr.fbUsersManager.currentUser.locationLatLng);
				console.log('dist :>> ', dist);
				if(!(dist <= this.searchRadius) && !$("#searchDog").val()) {
					return;
				}

				newCard.onclick = (event) => {
					this.selectedDog = dog;
					$("#missingLocationText").text(`${this.selectedDog.name} will be reported as lost near ${sctr.fbUsersManager.currentUser.location}`)
					$("#modalMissingTitle").text(`Report ${this.selectedDog.name} as lost`);
					
					//console.log(this.selectedDog);
				};

				$(newCard).find(".dogContactOwner").click((event) => {
					console.log("e");
					$("#userCardName").text(`${owner.firstName} ${owner.lastName}`);
					$("#userCardEmail").text(owner.email);
					$("#userCardLocation").text(`Lives near ${owner.location}`);

					if(owner.photoUrl) {
						$("#userCardImage").attr("src", owner.photoUrl);
					} else {
						$("#userCardImage").attr("src", "images/default_user.png");
					}

					$("#ownerContactDialog").modal("show");
				});
	
				newList.appendChild(newCard);
			});
		}

		const oldList = document.querySelector("#dogListContainer");
		oldList.removeAttribute("id");
		oldList.hidden = true;

		oldList.parentElement.appendChild(newList);
	}

	createDogCard(dog) {
		let missingLocationElement = dog.isMissing ? `<p class="card-text text-muted mt-1">Last seen near ${dog.lostLocation}</p>` : "";
		let card = `
			<div class="card dogCard" data-id="${dog.id}">
				<img class="card-img-top"
				src="${dog.photoUrl != null ? dog.photoUrl : ''}"
				alt="${dog.name}'s Photo">
				<div class="card-body">
					<div class="dogCardTitleContainer">
						<h5 class="card-title"><b>${dog.name}</b></h5>
						<p class="missingText redHighlight marginTopBottomAuto">${dog.isMissing ? "MISSING" : ""}</p>
					</div>
					<p class="card-text text-muted ${dog.isMissing ? "mb-0" : ""}">${dog.breed}</p>
					${missingLocationElement}
					<p class="card-text">${dog.description}</p>
					<a href="#" class="card-link floatRight dogContactOwner">CONTACT OWNER</a>
				</div>
			</div>
		`;
		return htmlToElement(card);
	}

	filterDogs(radius) {

	}
}

sctr.ProfilePageController = class {
	constructor() {
		this.dogPhoto = null;
		this.editDogPhoto = null;
		this.userPhoto = null;
		this.selectedDog = null;
		this.selectedLatLng = null;
		this.selectedMissingLatLng = null;

		sctr.initDrawer();

		this.ps = placeSearch({
			key: sctr.MAPQUEST_API_KEY,
			container: document.querySelector('#modalInputLocation')
		});

		this.ps.on('change', (e) => {
			this.selectedLatLng = e.result.latlng;
		});

		this.psMissingLocation = placeSearch({
			key: sctr.MAPQUEST_API_KEY,
			container: document.querySelector('#modalInputMissingLocation')
		});

		this.psMissingLocation.on('change', (e) => {
			this.selectedMissingLatLng = e.result.latlng;
			$("#missingLocationText").text(`${this.selectedDog.name} will be reported as lost near ${this.psMissingLocation.getVal()}`)
		})

		document.getElementById("submitEditProfile").addEventListener("click", () => {

			const firstName = $("#modalInputFirstName").val();
			const lastName = $("#modalInputLastName").val();
			const locationText = this.ps.getVal();
			const locationLatLng = this.selectedLatLng ?
				new firebase.firestore.GeoPoint(this.selectedLatLng.lat, this.selectedLatLng.lng) : null;

			sctr.fbUsersManager.update(firstName, lastName, locationText, locationLatLng, this.userPhoto);

			$("#userPhotoFile").val("");
		});

		document.getElementById("submitAddDog").addEventListener("click", () => {
			const dogName = $("#modalInputDogName").val();
			const dogBreed = $("#modalInputDogBreed").val();
			const dogDescription = $("#modalInputDogDescription").val();

			sctr.fbDogsManager.add(dogName, dogBreed, dogDescription, this.dogPhoto);

			$("#modalInputDogName").val("");
			$("#modalInputDogBreed").val("");
			$("#modalInputDogDescription").val("");
			$("#modalDogPhoto").css("display", "hidden");
			$("#dogPhotoFile").val("");
		});

		document.getElementById("submitEditDog").addEventListener("click", () => {
			const dogName = $("#modalInputEditDogName").val();
			const dogBreed = $("#modalInputEditDogBreed").val();
			const dogDescription = $("#modalInputEditDogDescription").val();

			sctr.fbDogsManager.update(this.selectedDog.id, dogName, dogBreed, dogDescription, this.editDogPhoto);

			$("#dogPhotoFile").val("");
		});

		document.getElementById("addDogPhotoButton").addEventListener("click", (event) => {
			document.querySelector("#dogPhotoFile").click();
		});

		document.getElementById("editDogPhotoButton").addEventListener("click", (event) => {
			document.querySelector("#dogEditPhotoFile").click();
		});

		document.getElementById("userEditPhotoButton").addEventListener("click", (event) => {
			document.querySelector("#userPhotoFile").click();
		});

		document.getElementById("dogPhotoFile").addEventListener("change", (event) => {
			this.dogPhoto = event.target.files[0];
			const photo = $("#modalDogPhoto");
			photo.attr("src", URL.createObjectURL(this.dogPhoto));
			photo.css("display", "block");
		});

		document.getElementById("dogEditPhotoFile").addEventListener("change", (event) => {
			this.editDogPhoto = event.target.files[0];
			const photo = $("#modalEditDogPhoto");
			photo.attr("src", URL.createObjectURL(this.editDogPhoto));
		});

		document.getElementById("userPhotoFile").addEventListener("change", (event) => {
			this.userPhoto = event.target.files[0];
			const photo = $("#modalUserPhoto");
			photo.attr("src", URL.createObjectURL(this.userPhoto));
			photo.css("display", "block");
		});

		document.getElementById("submitReportMissingDog").addEventListener("click", () => {
			const location = this.psMissingLocation.getVal();
			const locationLatLng = this.selectedMissingLatLng ?
			new firebase.firestore.GeoPoint(this.selectedMissingLatLng.lat, this.selectedMissingLatLng.lng) : sctr.fbUsersManager.currentUser.locationLatLng;

			sctr.fbDogsManager.reportDogAsMissing(this.selectedDog.id, location, locationLatLng);

			$("dogPhotoFile").val("");
		});

		document.getElementById("submitReportFoundDog").addEventListener("click", () => {
			sctr.fbDogsManager.reportDogAsFound(this.selectedDog.id);
		});

		document.getElementById("submitDeleteDog").addEventListener("click", () => {
			sctr.fbDogsManager.deleteDog(this.selectedDog.id);
			$("#editDogDialog").modal('hide');
		});

		sctr.fbUsersManager.addUserChangeCallback(this.updateView.bind(this));
		sctr.fbDogsManager.beginListening(true, this.updateDogList.bind(this));
	}

	createDogCard(dog) {
		let card = `
			<div class="card dogCard" data-id="${dog.id}">
				<img class="card-img-top"
				src="${dog.photoUrl != null ? dog.photoUrl : ''}"
				alt="${dog.name}'s Photo">
				<div class="card-body">
					<div class="dogCardTitleContainer">
						<h5 class="card-title"><b>${dog.name}</b></h5>
						<p class="missingText redHighlight marginTopBottomAuto">${dog.isMissing ? "MISSING" : ""}</p>
					</div>
					<p class="card-text text-muted">${dog.breed}</p>
					<p class="card-text">${dog.description}</p>
					<a href="#" class="card-link editDogButton">EDIT</a>
					<a href="#" class="card-link floatRight missingButton ${!dog.isMissing ? "missingText" : ""}">${dog.isMissing ? "REPORT AS FOUND" : "REPORT AS MISSING"}</a>
				</div>
			</div>
		`;
		return htmlToElement(card);
	}

	updateView() {
		const user = sctr.fbUsersManager.currentUser;
		const nameFormatted = `${user.firstName} ${user.lastName}`;
		$("#drawerProfileName").text(nameFormatted);
		$("#drawerProfileEmail").text(user.email);
		if(user.photoUrl) {
			$("#drawerProfileImage").attr("src", user.photoUrl);
		}

		$("#userCardName").text(nameFormatted);
		$("#userCardEmail").text(user.email);
		$("#userCardLocation").text(user.location);

		$("#modalInputFirstName").val(user.firstName);
		$("#modalInputLastName").val(user.lastName);
		this.ps.setVal(user.location);

		if(user.photoUrl) {
			$("#userCardImage").attr("src", user.photoUrl);
			$("#modalUserPhoto").attr("src", user.photoUrl).css("display", "block");
		}
	}

	updateDogList() {
		const newList = htmlToElement('<div id="dogListContainer"></div>');

		for(let i = 0; i < sctr.fbDogsManager.length; i++) {
			const dog = sctr.fbDogsManager.getDogAtIndex(i);
			const newCard = this.createDogCard(dog);

			newCard.onclick = (event) => {
				this.selectedDog = dog;
				$("#missingLocationText").text(`${this.selectedDog.name} will be reported as lost near ${sctr.fbUsersManager.currentUser.location}`)
				$("#modalMissingTitle").text(`Report ${this.selectedDog.name} as lost`);
				//console.log(this.selectedDog);
				$("#reportAsFoundText").text(`Do you want to report ${this.selectedDog.name} as found?`);
				$("#confirmDeleteText").text(`Are you sure you want to delete ${this.selectedDog.name}?`);
			};

			$(newCard).find(".editDogButton").click((event) => {
				$("#editDogModalTitle").text(`Edit ${dog.name}`);
				$("#modalEditDogPhoto").attr("src", dog.photoUrl);
				$("#modalInputEditDogName").val(dog.name);
				$("#modalInputEditDogBreed").val(dog.breed);
				$("#modalInputEditDogDescription").val(dog.description);
				$("#editDogDialog").modal('show');
			});

			$(newCard).find(".missingButton").click((event) => {
				if(dog.isMissing) {
					$("#reportFoundDogDialog").modal('show');
				}
				else {
					this.psMissingLocation.setVal(sctr.fbUsersManager.currentUser.location);
					$("#reportMissingDogDialog").modal('show');
				}
			});

			newList.appendChild(newCard);
		}

		const oldList = document.querySelector("#dogListContainer");
		oldList.removeAttribute("id");
		oldList.hidden = true;

		oldList.parentElement.appendChild(newList);
	}
}

sctr.LoginPageController = class {

	constructor() {

		this.ps = placeSearch({
			key: sctr.MAPQUEST_API_KEY,
			container: document.querySelector('#modalInputLocation')
		});

		this.selectedLatLng = null;

		document.getElementById("loginButton").addEventListener("click", () => {
			const inputEmail = $("#inputEmail").val();
			const inputPassword = $("#inputPassword").val();

			sctr.fbAuthManager.signIn(inputEmail, inputPassword);
		});

		document.getElementById("submitCreateAccount").addEventListener("click", () => {
			if (this.selectedLatLng == null) {
				//TODO: MODAL
				return;
			}

			const inputEmail = $("#modalInputEmail").val();
			const inputPassword = $("#modalInputPassword").val();
			const firstName = $("#modalInputFirstName").val();
			const lastName = $("#modalInputLastName").val();
			const locationText = this.ps.getVal();
			sctr.addingUserToDatabase = true;

			firebase.auth().createUserWithEmailAndPassword(inputEmail, inputPassword).then((userCredential) => {
				const user = userCredential.user;
				sctr.fbUsersManager.add(user.uid, inputEmail, firstName, lastName,
					new firebase.firestore.GeoPoint(this.selectedLatLng.lat, this.selectedLatLng.lng), locationText, sctr.checkForRedirects);
			}).catch((error) => {
				var errorCode = error.code;
				var errorMessage = error.message;

				console.log("Create account error", errorCode, errorMessage);
			});

		});

		this.ps.on('change', (e) => {
			this.selectedLatLng = e.result.latlng;
		});
	}
}

sctr.Dog = class {
	constructor(id, name, breed, description, lostLocation, lostLocationLatLng, isMissing, owner, ownerUUID, photoUrl) {
		this.id = id;
		this.ownerUUID = ownerUUID;
		this.name = name;
		this.breed = breed;
		this.isMissing = isMissing;
		this.owner = owner;
		this.description = description;
		this.lostLocation = lostLocation;
		this.lostLocationLatLng = lostLocationLatLng;
		this.photoUrl = photoUrl;
		console.log('owner :>> ', owner);
	}
}

sctr.User = class {
	constructor(uid, email, firstName, lastName, locationLatLng, location, photoUrl) {
		this.uid = uid;
		this.email = email;
		this.firstName = firstName;
		this.lastName = lastName;
		this.locationLatLng = locationLatLng;
		this.location = location;
		this.photoUrl = photoUrl;
	}
}

sctr.FbUsersManager = class {
	constructor(uid) {
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(sctr.FB_COLLECTION_USERS);
		this.currentUser = null;
		this.currentUserReference = null;
		this._uid = uid;

		this._userChangedCallbacks = [];

		this.beginListening(this._userDataChanged.bind(this));
	}

	beginListening(changeListener) {

		if (this._uid == null) {
			return;
		}

		const query = this._ref.doc(this._uid); //where(sctr.FB_KEY_AUTH_ID, "==", this._uid);

		this._unsubscribe = query.onSnapshot((doc) => {
			//this._documentSnapshots = querySnapshot.docs;
			if (doc.exists) {
				console.log('doc :>> ', doc);
				this._documentSnapshot = doc;
				changeListener(doc);
			} else {
				//window.location.href = "/";
			}
		});
	}

	stopListening() {
		this._unsubscribe();
	}

	_userDataChanged(userData) {

		this.currentUser = this.userObjectFromReference(userData);

		this.currentUserReference = this._ref.doc(this.currentUser.uid);

		for (let callback of this._userChangedCallbacks) {
			callback();
		}
	}

	addUserChangeCallback(callback) {
		this._userChangedCallbacks.push(callback);
	}

	userObjectFromReference(ref) {
		return new sctr.User(
			ref.get(sctr.FB_KEY_AUTH_ID),
			ref.get(sctr.FB_KEY_EMAIL),
			ref.get(sctr.FB_KEY_FIRSTNAME),
			ref.get(sctr.FB_KEY_LASTNAME),
			ref.get(sctr.FB_KEY_LOCATIONLATLNG),
			ref.get(sctr.FB_KEY_LOCATION),
			ref.get(sctr.FB_KEY_PHOTOURL)
		);
	}

	add(uid, email, firstName, lastName, locationLatLng, location, resolveHandler) {
		this._ref.doc(uid).set({
				[sctr.FB_KEY_AUTH_ID]: uid,
				[sctr.FB_KEY_EMAIL]: email,
				[sctr.FB_KEY_FIRSTNAME]: firstName,
				[sctr.FB_KEY_LASTNAME]: lastName,
				[sctr.FB_KEY_LOCATIONLATLNG]: locationLatLng,
				[sctr.FB_KEY_LOCATION]: location
			})
			.then(function () {
				//console.log("Document written with ID: ", docRef.id);

				if (resolveHandler) {
					resolveHandler();
				}
			})
			.catch(function (error) {
				console.error("Error: ", error);
			});
	}

	update(firstName, lastName, location, locationLatLng, photoFile) {

		const updateData = {
			[sctr.FB_KEY_FIRSTNAME]: firstName,
			[sctr.FB_KEY_LASTNAME]: lastName
		}

		if (location && locationLatLng) {
			updateData[sctr.FB_KEY_LOCATION] = location;
			updateData[sctr.FB_KEY_LOCATIONLATLNG] = locationLatLng;
		}

		if(photoFile) {
			this.updatePhoto(photoFile);
		}

		this._ref.doc(this.currentUser.uid).update(updateData)
			.then(() => {
				console.log("Updated document");
			})
			.catch(function (error) {
				console.error("Error: ", error);
			});
	}

	updatePhoto(photoFile) {
		const storageRef = firebase.storage().ref().child(this._uid);

		storageRef.put(photoFile).then((uploadTaskSnapshot) => {
			storageRef.getDownloadURL().then((downloadUrl) => {
				this.currentUserReference.update({
					[sctr.FB_KEY_PHOTOURL]: downloadUrl
				});
			});
		});
	}
}

sctr.FbDogsManager = class {
	constructor() {
		this._documentSnapshots = [];
		this._collectionRef = firebase.firestore().collection(sctr.FB_COLLECTION_DOGS);
		this.nameQuery = null;
		this.query = this._collectionRef;
	}

	setQuery(dogName) {
		this.query = this._collectionRef;
		this.nameQuery = dogName;
		console.log(dogName);
		if(dogName) {
			this.query = this.query.orderBy(sctr.FB_KEY_DOG_NAME)
			.startAt(dogName)
			.endAt(dogName + '\uf8ff');
		}
	}

	beginListening(dogsForCurrentUserOnly, changeListener) {

		//let query = this._ref.orderBy(rhit.FB_KEY_LAST_TOUCHED, "desc").limit(50);

		if(dogsForCurrentUserOnly && !this.nameQuery) {
			this.query = this.query.where(sctr.FB_KEY_DOG_OWNERUUID, "==", sctr.fbUsersManager._uid);
		}

		this._unsubscribe = this.query.onSnapshot((querySnapshot) => {
				this._documentSnapshots = querySnapshot.docs;
				changeListener();
		});

	}

	stopListening() {
		this._unsubscribe();
	}

	add(name, breed, description, photoFile) {

		this._collectionRef.add({
				[sctr.FB_KEY_DOG_NAME]: name,
				[sctr.FB_KEY_DOG_BREED]: breed,
				[sctr.FB_KEY_DOG_DESCRIPTION]: description,
				[sctr.FB_KEY_DOG_LOSTLOCATION]: null,
				[sctr.FB_KEY_DOG_LOSTLOCATIONLATLNG]: null,
				[sctr.FB_KEY_DOG_ISMISSING]: false,
				[sctr.FB_KEY_DOG_OWNER]: sctr.fbUsersManager.currentUserReference,
				[sctr.FB_KEY_DOG_OWNERUUID]: sctr.fbUsersManager.currentUser.uid,
				[sctr.FB_KEY_DOG_PHOTOURL]: null
			})
			.then((docRef) => {
				console.log("Document written with ID: ", docRef.id);

				this.updatePhoto(docRef.id, photoFile);
			})
			.catch(function (error) {
				console.error("Error: ", error);
			});

	}

	update(id, name, breed, description, photoFile) {

		const updateData = {
			[sctr.FB_KEY_DOG_NAME]: name,
			[sctr.FB_KEY_DOG_BREED]: breed,
			[sctr.FB_KEY_DOG_DESCRIPTION]: description,
		}

		if(photoFile) {
			this.updatePhoto(id, photoFile);
		}

		this._collectionRef.doc(id).update(updateData)
			.then(() => {
				console.log("Updated document");
			})
			.catch(function (error) {
				console.error("Error: ", error);
			});
	}

	reportDogAsMissing(id, location, locationLatLng) {

		const updateData = {
			[sctr.FB_KEY_DOG_LOSTLOCATION]: location,
			[sctr.FB_KEY_DOG_LOSTLOCATIONLATLNG]: locationLatLng,
			[sctr.FB_KEY_DOG_ISMISSING]: true,
		}

		this._collectionRef.doc(id).update(updateData)
			.then(() => {
				console.log("Updated document");
			})
			.catch(function (error) {
				console.error("Error: ", error);
			});
	}

	reportDogAsFound(id) {

		const updateData = {
			[sctr.FB_KEY_DOG_LOSTLOCATION]: null,
			[sctr.FB_KEY_DOG_LOSTLOCATIONLATLNG]: null,
			[sctr.FB_KEY_DOG_ISMISSING]: false,
		}

		this._collectionRef.doc(id).update(updateData)
			.then(() => {
				console.log("Updated document");
			})
			.catch(function (error) {
				console.error("Error: ", error);
			});
	}

	deleteDog(id) {
		this._collectionRef.doc(id).delete();
	}

	updatePhoto(dogId, photoFile) {
		const storageRef = firebase.storage().ref().child(dogId);

		storageRef.put(photoFile).then((uploadTaskSnapshot) => {
			storageRef.getDownloadURL().then((downloadUrl) => {
				this._collectionRef.doc(dogId).update({
					[sctr.FB_KEY_DOG_PHOTOURL]: downloadUrl
				});
			});
		});
	}

	dogObjectFromReference(ref) {
		return new sctr.Dog(
			ref.id,
			ref.get(sctr.FB_KEY_DOG_NAME),
			ref.get(sctr.FB_KEY_DOG_BREED),
			ref.get(sctr.FB_KEY_DOG_DESCRIPTION),
			ref.get(sctr.FB_KEY_DOG_LOSTLOCATION),
			ref.get(sctr.FB_KEY_DOG_LOSTLOCATIONLATLNG),
			ref.get(sctr.FB_KEY_DOG_ISMISSING),
			ref.get(sctr.FB_KEY_DOG_OWNER),
			ref.get(sctr.FB_KEY_DOG_OWNERUUID),
			ref.get(sctr.FB_KEY_DOG_PHOTOURL)
		);
	}

	getDogAtIndex(index) {
		const docSnapshot = this._documentSnapshots[index];

		const dog = this.dogObjectFromReference(docSnapshot);

		return dog;
	}

	getDogFromId(id) {
		return this.dogObjectFromReference(this._collectionRef.doc(id));
	}

	get length() {
		return this._documentSnapshots.length;
	}
}

sctr.FbAuthManager = class {
	constructor() {

	}

	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user;
			changeListener(user);
		});
	}

	signIn(email, password) {
		firebase.auth().signInWithEmailAndPassword(email, password).catch((error) => {
			var errorCode = error.code;
			var errorMessage = error.message;
			console.log("Existing account log in error", errorCode, errorMessage);
		});
	}

	signOut() {
		firebase.auth().signOut().catch((error) => {
			console.log("Sign out error");
		});
	}

	get isSignedIn() {
		return !!this._user;
	}

	get uid() {
		return this._user.uid;
	}
}

sctr.checkForRedirects = function () {
	if (document.querySelector("#loginPage") && sctr.fbAuthManager.isSignedIn) {
		window.location.href = "/home.html";
	}

	if(document.querySelector("#profilePage") && !sctr.fbAuthManager.isSignedIn) {
		window.location.href = "/index.html";
	}

	if(document.querySelector("#mainPage") && !sctr.fbAuthManager.isSignedIn) {
		window.location.href = "/index.html";
	}
}

sctr.initDrawer = function () {

	document.getElementById("menuHome").onclick = (event) => {
		window.location.href = "/home.html";
	}

	document.getElementById("menuProfile").onclick = (event) => {
		window.location.href = "/profile.html";
	}

	document.getElementById("menuSignOut").onclick = (event) => {
		sctr.fbAuthManager.signOut();
		window.location.href = "/";
	}

}

sctr.initializePage = function (user) {

	const id = user ? user.uid : null;

	sctr.fbUsersManager = new sctr.FbUsersManager(id);
	sctr.fbDogsManager = new sctr.FbDogsManager();

	if (document.querySelector("#loginPage")) {
		new sctr.LoginPageController();

		try {
			sctr.startFirebaseUI();
		} catch (e) {
			console.log("firebaseUI already running");
		}

		//sctr.initMapquest();
		return;
	}

	if (document.querySelector("#mainPage")) {
		new sctr.HomePageController();
	}

	if (document.querySelector("#profilePage")) {
		new sctr.ProfilePageController();
	}
}

// https://www.movable-type.co.uk/scripts/latlong.html
sctr.haversineFormula = function (lat1, lon1, lat2, lon2) {
	const R = 6371e3; // metres
	const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
	const φ2 = lat2 * Math.PI / 180;
	const Δφ = (lat2 - lat1) * Math.PI / 180;
	const Δλ = (lon2 - lon1) * Math.PI / 180;

	const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) *
		Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	const d = R * c; // in metres

	return d;
}

sctr.milesToMeters = function(miles) {
	return miles * 1609.34;
}

sctr.distanceBetweenGeopoints = function(geopoint1, geopoint2) {
	return sctr.haversineFormula(geopoint1.latitude, geopoint1.longitude, geopoint2.latitude, geopoint2.longitude);
}

sctr.startFirebaseUI = function () {
	var uiConfig = {
		signInSuccessUrl: '/home.html',
		signInOptions: [
			firebase.auth.GoogleAuthProvider.PROVIDER_ID
		]
	};

	const ui = new firebaseui.auth.AuthUI(firebase.auth());
	ui.start('#firebaseui-auth-container', uiConfig);
}


sctr.main = function () {
	sctr.fbAuthManager = new sctr.FbAuthManager();
	sctr.fbAuthManager.beginListening((user) => {
		if (sctr.addingUserToDatabase) {
			return;
		}

		sctr.checkForRedirects();
		sctr.initializePage(user);
	});
}

sctr.main();