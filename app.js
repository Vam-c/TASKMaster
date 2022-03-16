//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(session({
    secret: "This is to hash the password",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://admin-vamsee:vamsee@cluster0-shard-00-00.upkqa.mongodb.net:27017,cluster0-shard-00-01.upkqa.mongodb.net:27017,cluster0-shard-00-02.upkqa.mongodb.net:27017/todoDB?ssl=true&replicaSet=atlas-f7p89f-shard-0&authSource=admin&retryWrites=true&w=majority",{useNewUrlParser: true});

const itemSchema = new mongoose.Schema({
    name: String
});

const listSchema = new mongoose.Schema({
    name: String,
    items: [itemSchema]
});

const userSchema = new mongoose.Schema({
    username: String,
    password: String
});
userSchema.plugin(passportLocalMongoose);
const List = mongoose.model("List", listSchema);
const Item = mongoose.model("Item", itemSchema);
const User = mongoose.model("User", userSchema);


passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const item1 = new Item({
    name: "Welcome to yout To-Do list."
});
const item2 = new Item({
    name: "+ to add new item."
});
const item3 = new Item({
    name: "<--- checkbox to mark as done."
});
const defaultItems = [item1, item2, item3];

//register page.
app.get("/register", function(req, res){
    res.render("register");
});
app.post("/register", function(req, res){
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if (err){
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local",{ failureRedirect: '/login'})(req, res, function(){
                res.redirect("/" + req.user.username);
            });
        }
    });
});

//login page.
app.get("/login", function(req, res){
    res.render("login");
});
app.post("/login", function(req, res){
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function(err){
        if (err){
            console.log(err);
            res.redirect("/login");
        } else {
     
            passport.authenticate("local", { failureRedirect: '/login'})(req, res, function(){
                res.redirect("/"+ req.user.username);
            });
        }     
    });
});
//logout.
app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/login");
});

app.get("/", function(req, res) {
    Item.find({},function(err, returnedItems){
        if(err){
            console.log(err);
        } else {
            if(returnedItems.length === 0){
                Item.insertMany(defaultItems, function(err){
                    if(err){
                        console.log(err);
                    } else {
                        console.log("Default items inserted into database");
                    }
                });
                res.redirect("/");
            } else {
                res.render("list", {listTitle: "This is the To Do Template", newListItems: returnedItems});
            }
        }
    });
});

app.post("/", function(req, res){
    const listName = req.body.list;
    const itemName = req.body.newItem;

    const item = new Item({
      name: itemName
  });

    if(listName === "Today"){
        item.save();
        res.redirect("/");
    } else {
        List.findOne({name: listName}, function(err, foundList){
            if(err){
                console.log(err);
            } else {
                foundList.items.push(item);
                foundList.save();
                res.redirect("/"+ listName);
            }
        });
    }
});

app.post("/delete", function(req, res){
    const checkedItemID = req.body.checkbox;
    const listName = req.body.listName;

    if(listName === "This is the To Do Template"){
        Item.findByIdAndRemove(checkedItemID, function(err){
            if(err){
                console.log(err);
            } else {
                console.log("Item deleted");
                res.redirect("/");
            }
        });
    } else {
        List.findOneAndUpdate({name: listName}, {$pull: {items: {_id: checkedItemID}}}, function(err, foundList){
            if(err){
                console.log(err);
            } else {
                res.redirect("/"+ listName);
            }
        });
    }
});

app.get("/:customListName", function(req, res){
    if(req.isAuthenticated()){
        const customListName = req.params.customListName;
        if(req.user.username !== customListName){
            res.redirect("/" + req.user.username);
        } else {
            List.findOne({name: customListName}, function(err, returned){
                if(err){
                    console.log(err);
                }else{
                    if(!returned){
                        const list = new List({
                            name: customListName,
                            items: defaultItems
                        });
                        list.save();
                        res.redirect("/"+customListName);
                    } else {
                        res.render("list",{listTitle: customListName, newListItems: returned.items});
                    }
                }
            });
        }    
    } else {
        console.log("User not authenticated. (At custom list level)");
        res.redirect("/login");
    }
    

});



app.listen(3000, function() {
  console.log("Server started successfully");
});
