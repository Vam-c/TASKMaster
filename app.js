//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

mongoose.connect("mongodb://admin-vamsee:vamsee@cluster0-shard-00-00.upkqa.mongodb.net:27017,cluster0-shard-00-01.upkqa.mongodb.net:27017,cluster0-shard-00-02.upkqa.mongodb.net:27017/todoDB?ssl=true&replicaSet=atlas-f7p89f-shard-0&authSource=admin&retryWrites=true&w=majority",{useNewUrlParser: true});

const itemSchema = new mongoose.Schema({
    name: String
});

const listSchema = new mongoose.Schema({
    name: String,
    items: [itemSchema]
});

const List = mongoose.model("List", listSchema);
const Item = mongoose.model("Item", itemSchema);

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
                res.render("list", {listTitle: "Today", newListItems: returnedItems});
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

    if(listName === "Today"){
        Item.findByIdAndRemove(checkedItemID,function(err){
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
                res.redirect("/"+listName);
            }
        });
    }
});

app.get("/:customListName", function(req, res){
    const customListName = _.capitalize(req.params.customListName);
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

});

app.get("/about", function(req, res){
  res.render("about");
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
