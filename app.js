//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const https = require("https");

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
    name: "Welcome to your To-Do list."
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
            res.render("alert",{message: err, redirect: "/register"});
        } else {
            passport.authenticate("local",{ failureRedirect: '/register'})(req, res, function(){
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
            res.render("alert",{message: err, redirect: "/login"});
        } else {
            passport.authenticate("local", {failureRedirect: '/login'}, function(err, thisModel, error){
                if(err){
                    console.log(err);
                } else if(error) {
                    res.render("alert",{message: error, redirect: "/login"});
                } else {
                    res.redirect("/"+ req.user.username);    
                }
                
            })(req, res, function(){
               //why is this required for the previous page to render.
            });
        }     
    });
});
//logout.
app.get("/logout", function(req, res){
    req.logout();
    res.render("alert",{message: "Successfully logged out.", redirect: "/login"});
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
                //weather render.
                const query = "Mumbai";
                const appid = "2496ff6d51d64f03802e33f7e0718f36";
                const url = "https://api.openweathermap.org/data/2.5/weather?q="+query+"&appid="+appid+"&units=metric";
                https.get("https://zenquotes.io/api/random", function(response){
                    response.on("data", function(data){
                        const quoteData = JSON.parse(data);  
                        https.get(url, function(res1){
                            res1.on("data",function(data){
                                const weatherData = JSON.parse(data);
                                const temperature = Math.round(weatherData.main.temp);
                                const icon = weatherData.weather[0].icon;
                                const iconurl = "http://openweathermap.org/img/wn/"+icon+"@2x.png";    
                                // console.log(quoteData[0]);                                            
                                res.render("list",{listTitle: "TASKMaster", newListItems: returnedItems,
                                    temp: temperature,
                                    icon: icon,
                                    iconurl: iconurl,
                                    place: query,
                                    quote: quoteData[0].q,
                                    author: quoteData[0].a,
                                });
                            });
                        });                          
                    });
                }); 
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

    if(listName === "TASKMaster"){
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
                        //weather render.
                        const query = "Mumbai";
                        const appid = "2496ff6d51d64f03802e33f7e0718f36";
                        const url = "https://api.openweathermap.org/data/2.5/weather?q="+query+"&appid="+appid+"&units=metric";
                        https.get("https://zenquotes.io/api/random", function(response){
                            response.on("data", function(data){
                                const quoteData = JSON.parse(data);  
                                https.get(url, function(res1){
                                    res1.on("data",function(data){
                                        const weatherData = JSON.parse(data);
                                        const temperature = Math.round(weatherData.main.temp);
                                        const icon = weatherData.weather[0].icon;
                                        const iconurl = "http://openweathermap.org/img/wn/"+icon+"@2x.png";    
                                        // console.log(quoteData[0]);                                            
                                        res.render("list",{listTitle: customListName, newListItems: returned.items,
                                            temp: temperature,
                                            icon: icon,
                                            iconurl: iconurl,
                                            place: query,
                                            quote: quoteData[0].q,
                                            author: quoteData[0].a,
                                        });
                                    });
                                });                          
                            });
                        }); 
                    }
                }
            });
        }    
    } else {
        res.render("alert",{message: "User not authenticated.", redirect: "/login"});
    }
    

});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function(){
    console.log("Server started successfully");
});
