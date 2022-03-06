const functions = require("firebase-functions");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const stream = require("stream");

const { credential } = require("firebase-admin");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: credential.applicationDefault(),
  databaseURL: "https://brius-lab.firebaseio.com",
});

const app = express();
app.use(cors());

app.get("/", (req, res, next) => {
  res.send("Hello World");
});

app.post("/voucher", async (req, res, next) => {
  try {
    if (!req.body.contact.id) throw { status: 404, message: "Sem ID" };
    const myId = req.body.contact.id;

    const bucket = admin.storage().bucket("ac-scripts");
    const file = await bucket.file("voucher-ex.txt");

    const myFile = await getFile(bucket, "voucher-ex.txt");
    let newFile = myFile.split("\r\n");
    const myVoucher = newFile[0];
    newFile.splice(0, 1);
    newFile = newFile.join("\r\n");

    const passthroughStream = new stream.PassThrough();
    passthroughStream.write(newFile);
    passthroughStream.end();

    passthroughStream.pipe(file.createWriteStream()).on("finish", () => {
      // The file upload is complete
    });

    console.log(`"voucher-ex.txt" uploaded to "ac-scripts"`);

    const updateContact = await axios.request({
      url: `https://weburn.api-us1.com/api/3/contacts/${myId}`,
      method: "PUT",
      headers: {
        "Api-Token":
          "e92532e2452e1308a243abb5eaca4079760b4f843f6e78920309907e3ca7e3736d25d6e6",
      },
      data: {
        contact: {
          fieldValues: [
            {
              field: "28",
              value: myVoucher,
            },
          ],
        },
      },
    });
    return res.json({
      ok: true,
      data: updateContact.data.fieldValues.filter((c) => c.field === "28"),
    });
  } catch (error) {
    console.error("my error", error);
    return res.status(error.status ? error.status : 500).send(error);
  }
});

app.get("/callback/:email", async (req, res, next) => {
  try {
    const email = req.params.email;

    const responseGetContact = await axios.request({
      url: `https://weburn.api-us1.com/api/3/contacts?email=${email}`,
      method: "GET",
      headers: {
        "Api-Token":
          "e92532e2452e1308a243abb5eaca4079760b4f843f6e78920309907e3ca7e3736d25d6e6",
      },
    });

    const myContact = responseGetContact.data.contacts[0];
    if (!myContact) throw { message: "Ninguem aqui" };

    const responseGetFieldValues = await axios.request({
      url: myContact.links.fieldValues,
      method: "GET",
      headers: {
        "Api-Token":
          "e92532e2452e1308a243abb5eaca4079760b4f843f6e78920309907e3ca7e3736d25d6e6",
      },
    });

    const voucher = responseGetFieldValues.data.fieldValues.find(
      (data) => data.field === "28"
    );

    if (!voucher) throw { message: "Sem Voucher" };
    if (!voucher.value) throw { message: "Voucher sem valor" };

    return res.json({
      contact: myContact,
      voucher: voucher.value,
    });
  } catch (error) {
    console.log("my error", error);
    return res.status(500).json({
      ...error,
    });
  }
});

app.get("/myCustomFields", async (req, res, next) => {
  try {
    const response1 = await axios.request({
      url: `https://weburn.api-us1.com/api/3/fields?limit=100`,
      method: "GET",
      headers: {
        "Api-Token":
          "e92532e2452e1308a243abb5eaca4079760b4f843f6e78920309907e3ca7e3736d25d6e6",
      },
    });

    res.json({
      data: response1.data,
    });
  } catch (error) {
    console.log("my error", error);
    return res.status(500).json({
      ...error,
    });
  }
});

app.get("/myContacts", async (req, res, next) => {
  try {
    const response1 = await axios.request({
      url: `https://weburn.api-us1.com/api/3/contacts`,
      method: "GET",
      headers: {
        "Api-Token":
          "e92532e2452e1308a243abb5eaca4079760b4f843f6e78920309907e3ca7e3736d25d6e6",
      },
    });

    res.json({
      data: response1.data,
    });
  } catch (error) {
    console.log("my error", error);
    return res.status(500).json({
      ...error,
    });
  }
});

async function getFile(bucket, filename) {
  const file = await bucket.file(filename).download();

  const content = file[0].toString("utf8");

  return content;
}

const ac = functions.https.onRequest(app);

module.exports = {
  ac,
};
