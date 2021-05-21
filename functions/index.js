const functions = require("firebase-functions");
const nodemailer = require('nodemailer');

const admin = require('firebase-admin');
admin.initializeApp();
//firebase emulators:start

const firestore = admin.firestore();
const DEFAULT_RANGE = 48300; //50 miles

const scouterNotificationService = nodemailer.createTransport({
  service: 'AOL',
  auth: {
    user: 'scouternotificationservice@aol.com',
    pass: 'loruoyjzrsjyddok'
  }
});

function haversineFormula(lat1, lon1, lat2, lon2) {
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

function sendEmailToAllUsers(userEmails, dogData, ownerData) {
  
  const text = `
    A dog has gone missing in your area!
    <p></p><p></p>
    <u>Dog Information:</u>
    <ul>
      <li>Name: ${dogData.name}</li>
      <li>Breed: ${dogData.breed}</li>
      <li>Description: ${dogData.description}</li>
      <li>Last seen location: ${dogData.lostLocation}</li>
    </ul>
    <p></p>
    <u>Owner Information:</u>
    <ul>
      <li>Name: ${ownerData.firstName} ${ownerData.lastName}</li>
      <li>Email: ${ownerData.email}</li>
    </ul>
    <p></p>
    <u>Image:</u>
    <p></p>
    <img src="${dogData.photoUrl}" style="width: 100%">
    `

  var mailOptions = {
    from: 'Scouter Notification Service <scouternotificationservice@aol.com',
    bcc: userEmails,
    subject: 'A dog has gone missing in your area!',
    html: text
  };

  scouterNotificationService.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

async function getUsersWithinRange(geopoint) {
  let userList = await getAllUsers();

  userList = userList.filter(user => haversineFormula(user.locationLatLng.latitude, user.locationLatLng.longitude,
    geopoint.latitude, geopoint.longitude) <= DEFAULT_RANGE);
  
  return userList;
}

async function getAllUsers() {
  const snapshot = await firestore.collection('Users').get()
  return snapshot.docs.map(doc => doc.data());
}

async function getOwnerOfDog(dogData) {
  let owner = await dogData.get('owner').get();
  return owner.data();
}

exports.missingListener = functions.firestore.document('/Dogs/{dogId}').onUpdate((change) => {
  let missingBefore = change.before.get('isMissing');
  let missingAfter = change.after.get('isMissing');

  if (missingBefore === false && missingAfter === true) {
    getOwnerOfDog(change.after).then((owner) => {
      getUsersWithinRange(change.after.get('lostLocationLatLng')).then((users) => {
        userEmails = users.map(user => user.email);
        userEmails = userEmails.filter(userEmail => userEmail != owner.email);
        sendEmailToAllUsers(userEmails, change.after.data(), owner);
      });
    });
  }

  return true;
});