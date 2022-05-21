const { Router } = require("express");
const router = Router();
const bcrypt = require("bcryptjs");
const User = require("./User");
const axios = require("axios");
// const fetch = require("node-fetch");
// import fetch from "node-fetch";
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const Credo = require("credo-node");
const Request = require("./Request");
const { uuid } = require("uuidv4");
require("dotenv").config();

router.post("/auth", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log(req.body);
    const user = await User.findOne({ username, email });
    console.log(user);
    if (user) {
      const match = bcrypt.compareSync(password, user.password);
      if (!match) {
        return res
          .status(500)
          .json({ message: "Username or password do not match" });
      }
      req.session.user = user;
      req.session.save((err) => console.log(err));
      console.log("login", req.session);

      return res.status(200).json({ user });
    } else {
      const userr = await User.findOne({ username });
      console.log(userr);
      if (userr) {
        return res
          .status(500)
          .json({ message: "Username not associated with email" });
      }
      console.log(password, email, username);
      const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
      const newUser = new User({
        username,
        email,
        password: hash,
      });
      await newUser.save();
      req.session.user = newUser;
      req.session.save((err) => console.log(err));
      console.log("signup", req.session);
      return res.status(200).json({ user: newUser });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
});

router.get("/products", async (req, res) => {
  try {
    const { id } = req.query;
    const user = await User.findById(id).populate("requests");
    console.log(req.session.user);
    return res.status(200).json({ user });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
});

router.get("/products/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const product = await Request.findOne({ uid });
    if (!product) {
      return res.status(500).json({ message: "Product not found" });
    }
    return res.status(200).json({ product });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
});

router.post("/products/new", async (req, res) => {
  try {
    const { username, twitterLink, totalAmount, title, code } = req.body;
    if (code !== process.env.SECRET_CODE) {
      return res.status(500).json({ message: "Wrong Code" });
    }
    const link = twitterLink.split("/");
    // process link
    // const image= await axios.post('')
    console.log(`${link[5]}`);
    const uid = uuid();
    const url = `http://localhost:3000/pay/${uid}`;
    const user = await User.findOne({ username });
    if (!user) {
      const newUser = await User.create({ username });
      const newRequest = new Request({
        username,
        image: twitterLink,
        totalAmount,
        uid,
        title,
        userId: newUser._id,
      });
      await newRequest.save();
      newUser.requests.push(newRequest._id);
      await newUser.save();
    }

    const newRequest = new Request({
      username,
      image: twitterLink,
      totalAmount,
      uid,
      title,
      userId: user._id,
    });
    await newRequest.save();
    user.requests.push(newRequest._id);
    await user.save();
    return res.status(200).json({ url });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
});

router.post("/pay", async (req, res) => {
  try {
    const { name, email, amount, phone, uid } = req.body;
    const ref = uuid().split("-")[4];
    const inputBody = {
      amount: Number(amount),
      currency: "NGN",
      redirectUrl: `http://localhost:3000/pay/${uid}?ref=${ref}`,
      transRef: ref,
      paymentOptions: "CARD,BANK,USSD",
      customerEmail: email,
      customerName: name,
      customerPhoneNo: phone,
      customFields: `uid|${uid}`,
    };

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "pk_demo-0mM2x4Qz41dJMTEnne9SPLTPMR7rgY.GyWqP6fsvs-d",
    };

    const url =
      "https://api.credocentral.com/credo-payment/v1/payments/initiate";
    fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(inputBody),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
        return res.status(200).json(data);
      })
      .catch((err) => console.log(err.message));
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
});

router.get("/pay/done", (req, res) => {
  const { ref } = req.query;
  const url = `https://api.credocentral.com/credo-payment/v1/transactions/${ref}/verify`;
  fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: "sk_demo-q6960pdFwAElr3V1BZpB4u8fnyoGA2.WpECmNuThi-d",
    },
  })
    .then((res) => res.json())
    .then(async (data) => {
      console.log(data);
      const product = await Request.findOne({
        uid: data.customFields.split("|")[1],
      });
      const existingRef = product.donators.some((donor) => donor.ref === ref);
      if (!existingRef) {
        return res.status(500).json({ message: "Something went wrong" });
      }
      product.donators.push({
        ref,
        name: data.customerName,
        email: data.customerEmail,
        phone: data.customerPhoneNo,
        amount: data.totalAmountPaid,
      });

      product.amountRaised += data.totalAmountPaid;
      await product.save();
      return res.status(200).json({ product });
    })
    .catch((err) => console.log(err.message));
});

module.exports = router;
