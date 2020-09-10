console.log("******************* running freeprod.js script ****************************");


/*
 Note on the format of G:
  entries of G are edges
  each entry contains three values:
   [ from_node   to_node   protograph_of_this_edge  depth_of_this_edge ]
*/


// How many protographs are allowed? (we could make this dynamic if we really wanted to)
var Ngraphs = 6;

// Set up some sizes
var subsizeX = 0.9*document.body.clientWidth/Ngraphs;
var subsizeY = 200;
var outputsizeY = 700;
var nodeRadius = 8;
var productnodeRadius = 5;
var cursorRadius = nodeRadius*4;
var subgraphNodes = new Array;

// Initialise subgraphNodes (ie. the lists of nodes in each protograph)
for (var n=0;n<Ngraphs;n++){
 subgraphNodes[n] = new Array;
}

var stickybasenodes = false; // we could make this a user control if we wanted to

var allowedLabels = ["updatefn", "address"]; // we have different classes of text nodes with labels in them, this defines the ones allowed to be shown
var addressDeltaX = 3; // offset of address labels from their nodes
var addressDeltaY = 3;
var updatefnDeltaX = 10; // offset of update function labels from their nodes
var updatefnDeltaY = -10;

var constructionAreaWidth = subsizeX*Ngraphs + 8; // 8 comes from the margin of the controls which sit above and below the construction area
var constructionAreaHeight = subsizeY;
var outputWidth = constructionAreaWidth;
var outputHeight = outputsizeY;

var d3colours = d3.scale.category10().domain([0, Ngraphs]); // this makes d3colours a *function* (which takes an integer input)
var colours = ["yellow","blue","orange","red","green","hotpink","darkorange","gold","forestgreen","grey75"];

var alphabet = new Array;
alphabet[0] = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
alphabet[1] = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
alphabet[2] = ["i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx"];
alphabet[3] = alphabet[1].map(s => s.toUpperCase()); // upper case letters
alphabet[4] = alphabet[2].map(s => s.toUpperCase()); // upper case roman numerals
alphabet[5] = alphabet[0].map(s => s.toLocaleString('zh-u-nu-hanidec')); // Chinese numerals

var newEdge = null;

var force = d3.layout.force()
    .size([constructionAreaWidth, constructionAreaHeight])
    .charge(-200) // strength of repulsion (if -ve) between nodes
    .linkDistance(50)
    .gravity(0) // set gravity to zero but customise it in the tickfn function
    .on("tick", tickfn);

var thesvg = d3.select("#graphareaConstruction").append("svg")
    .attr("id","constructionArea")
    .attr("width", constructionAreaWidth)
    .attr("height", constructionAreaHeight)
    .on("mousemove", mousemovefn)
    .on("mousedown", mousedownfn)
    .on("mouseenter", mouseenterfn)
    .on("mouseout", mouseoutfn)
    .on("dblclick", dblclickconstructionArea)
    .on("DOMMouseScroll", mousewheelfn);

// now that we have set the construction area width, we know how big the freeproduct area will be, so set it:
document.getElementById("graphareaFreeProduct").setAttribute("style","width:"+document.getElementById("constructionArea").clientWidth+"px");

// Add some lines to demarcate the protographs:
for (var i=1;i<Ngraphs;i++){
  thesvg.append("line")
        .attr("class", "delimiter")
        .attr("x1",i*subsizeX)
        .attr("x2",i*subsizeX)
        .attr("y1",0)
        .attr("y2",subsizeY);
}

thesvg.append("rect")
    .attr("width", constructionAreaWidth)
    .attr("height", constructionAreaHeight);

var nodes = force.nodes();
var links = force.links();
var node = thesvg.selectAll(".node"); // this just starts out as an empty array (or an empty array containing one empty arrays?)
var link = thesvg.selectAll(".link"); // empty at first


var thecursor = thesvg.append("circle")
                .attr("id", "thecursor")
                .attr("r", cursorRadius)
                .attr("transform", "translate(-100,-100)")
                .attr("class", "cursor");

restart();


// Return the centre x-coords for the nth protograph
function subgraphCX(n){
 return (0.5+n)*subsizeX;
}
// Return the centre y-coords for the nth protograph
function subgraphCY(n){
 return subsizeY/2;
}

// Create protograph nodes when the construction zone is double clicked
function dblclickconstructionArea(d) {
  // get click location:
  var point = d3.mouse(this);
  var x=Math.round(point[0]);
  var y=Math.round(point[1]);
  // which protograph was clicked?
  var ingraph = findSubgraph(x);

  var addnode = {x:x, y:y, cx:subgraphCX(ingraph), cy:subgraphCY(ingraph), subgraph:ingraph};
  var n = nodes.push(addnode);
  // add an id
  subgraphNodes[ingraph].push(n-1); // enumerate them, but start from zero (n-1)
  console.log("Protograph "+ingraph+" now has "+subgraphNodes[ingraph].length+" nodes");
  if (subgraphNodes[ingraph].length==1){ // "base" node for this protograph
   nodes[nodes.length-1].id="basenode_of_"+ingraph;
   if (stickybasenodes){
    nodes[nodes.length-1].fixed = true; // stick the base node to the middle of the plot for this protograph
   }
  } else if (subgraphNodes[ingraph].length > 1){ // "regular" node for this protograph
   nodes[nodes.length-1].id="node_in_"+ingraph;
  }
  event.preventDefault();
  restart();
}

// Change the "cursor" size with the mouse wheel if the SHIFT key is pressed
function mousewheelfn(){
 // Also update the size of the cursor in the free product graph (in d3), if it exists.
 if (event.shiftKey) {
  var delta = d3.event.detail;
  // set the allowed radii
  var minCircleRadius = 10;
  var maxCircleRadius = 100;
  cursorRadius += delta;
  if (cursorRadius<minCircleRadius) cursorRadius=minCircleRadius;
  if (cursorRadius>maxCircleRadius) cursorRadius=maxCircleRadius;

  var thenewcursor = d3.select("#thenewcursor");
  var thecursor = d3.select("#thecursor");

  thecursor.attr("r", cursorRadius);
  if (typeof thenewcursor != "undefined") {
   thenewcursor.attr("r", cursorRadius); // update "thenewcursor" if it exists (it won't until the first time the "free product" button is pressed)
  }
 }
}

// Function to call when dragging a node is finished
function dragendfn(d) {
 // do nothing
}

// When the mouse is moved in the protograph construction zone, move the "cursor" with it
function mousemovefn(){
  var thecursor = d3.select("#thecursor");
  thecursor.attr("transform", "translate(" + d3.mouse(this) + ")");
}

// Clicking in the protograph construction zone adds edges between nearby nodes
function mousedownfn(d,i){
 /*
  What we want to do:
   1. click on empty region
   2. did we click on or near an existing node?
     a. yes: start a new edge: need to click again for the other end(s)
     b. no: nothing to do
 */
  if (event.ctrlKey) {
   nodes.splice(i, 1);
   links = links.filter(function(l) {
    return l.source !== d && l.target !== d;
   });
   d3.event.stopPropagation();
   restart();

  }

  // If the user clicked while holding the SHIFT key, add a new node (same behaviour as double-clicking)
  if (event.shiftKey) {
   var point = d3.mouse(this);
   var x=Math.round(point[0]);
   var y=Math.round(point[1]);
   // which subgraph was clicked?
   var ingraph = findSubgraph(x);
   var addnode = {x:x, y:y, cx:subgraphCX(ingraph), cy:subgraphCY(ingraph), subgraph:ingraph};
   var n = nodes.push(addnode);
   // add an id? just to the base node for this subgraph
   subgraphNodes[ingraph].push(n-1); // enumerate them but start from zero (n-1)
   console.log("Protograph "+ingraph+" now has "+subgraphNodes[ingraph].length+" nodes");
   if (subgraphNodes[ingraph].length==1){ // "base" node for this protograph
    nodes[nodes.length-1].id="basenode"+ingraph;
   } else if (subgraphNodes[ingraph].length > 1){ // "regular" node for this protograph
    nodes[nodes.length-1].id="regularnode"+ingraph;
   }
   restart();
   return 0;
  }

  // get click location:
  var point = d3.mouse(this);
  var x=Math.round(point[0]);
  var y=Math.round(point[1]);
  // which subgraph was clicked?
  var ingraph = findSubgraph(x);

  // What is the closest node (if any)?
  var nearbyNodes = new Array;
  var minDist = Infinity;
  var nearest = null;
  nodes.forEach(function(target){
   var dist = Math.sqrt(Math.pow(target.x - x,2)+Math.pow(target.y - y,2));
//   if (dist < nodeRadius) {
   if (dist < cursorRadius) {
    nearbyNodes.push(target.index);
    if (dist<minDist){
     minDist = dist;
     nearest = target.index;
    }
   }
  });

  // If we are not close to an existing node, add a new node:
  if (nearest===null){
   if (newEdge === null) { // okay to add, we're NOT in the middle of adding a edge...
/*
    addnode = {x:x, y:y, cx:subgraphCX(ingraph), cy:subgraphCY(ingraph), subgraph:ingraph};
    n = nodes.push(addnode);
    newEdge = null; // reset edge-adding
    d3.select("body").style("cursor", "default"); // and put the cursor back to normal
*/
   } else {
    console.log("Ignoring edge-creation request which was not close to a node");
    newEdge = null;
    d3.select("body").style("cursor", "default"); // and put the cursor back to normal
   }
  } else {
   // are we connecting an edge, or starting a new edge?
   if (newEdge === null){ // we are starting a new one...
    newEdge = nearest;
    d3.select("body").style("cursor", "copy"); // so change the cursor to show that something is happening (most obvious on Macs, not so much on Windows)
   } else {
    // we are connecting an edge-in-progress (to the closest node):
    toggleLink(newEdge,nearest); // the function will decide whether to add, remove or ignore the proposed link
    newEdge = null; // reset edge-adding
    d3.select("body").style("cursor", "default"); // and reset the cursor too
   }
  }
  event.preventDefault();
  restart();
}

// For an x-coord "x", see which protograph construction zone it falls into
function findSubgraph(x){
 s = Math.min(Ngraphs-1, Math.floor(x/subsizeX)); // the min() is to stop overflow at the right-hand edge
 return s;
}

// Add or remove links between nodes
function toggleLink(from,to){
/*
 Take the index of two nodes, and test them:
  - same?         ignore
  - link exists?  delete it
  - not linked?   add link
*/
 var debug = false;

 if (from==to){
  // ignore!
  console.log("Ignoring request to link a node to itself");
 } else if (nodes[from].subgraph != nodes[to].subgraph) {
  console.log("Cannot link across protographs");
 } else {
  var linkexists = false;
  for (var j=0;j<links.length;j++){
   if ((links[j].source.index==from && links[j].target.index==to) || (links[j].source.index==to && links[j].target.index==from)){
    linkexists = true;
    // remove the (conceptual) link
    links.splice(j,1);
    // remove the d3 (physics?) link
    link[0].splice(j,1); // must do this as well as removing rr below, or link[0] gets muddled up (the wrong element disappears)
    // remove the SVG line element (get the "link element" and remove its child (the svg line)
    rr = document.getElementById("link_"+from+"_"+to);
    if (rr===null) rr = document.getElementById("link_"+to+"_"+from);
    console.log(" Removed link ID "+rr.id);
    rr.parentNode.removeChild(rr);
   }
  };

  // did we get this far and haven't found one to remove? then add it!
  if (!linkexists){
   // create a new link, since it does not exist:
   links.push({source: from, target: to, subgraph: nodes[from].subgraph});
   if (debug) console.log("Added link "+from+" to "+to);
  }
 }
 restart();
} // end of toggleLink function

// tick function for the protographs (runs the graph physics at each timestep)
function tickfn(e){
  link.attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });

  node.each(gravityfn(0.2*e.alpha))
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; });
} // end of tickfn function

// gravity function for the protographs, nodes are attracted to (cx,cy)
function gravityfn(alpha){
 return function(d){
  d.x += (d.cx - d.x)*alpha;
  d.y += (d.cy - d.y)*alpha;
 };
} // end of gravityfn function

// gravity function for the free product graph: nodes are attracted to (cx,cy)
function newgravityfn(alpha){
 setAntigravity();
 return function(d){
  d.x += (d.cx - d.x)*alpha;
  d.y += (d.cy - d.y)*alpha;
 };
} // end of newgravityfn function

// Draw the protograph nodes and edges
function restart(){
 // only act if the protograph construction area graph (in the "thesvg" element) exists:
 if (typeof thesvg != "undefined") {
  link = link.data(links);
  link.enter().insert("line", ".node")
      .attr("class", function(d){return d.productlink?"productlink":"link";})
      .attr("id", function(d,i){
       return "link_"+links[i].source+"_"+links[i].target;
      })
      .style("stroke-width", function(d,i){
       return (1+links[i].subgraph);
      })
      .style("stroke", function(d,i){
       return setEdgecolour(links[i].subgraph);
      });

  node = node.data(nodes);
//  node.enter().insert("circle", ".cursor");
  node.enter().insert("circle")
      .attr("class", function(d){return d.productnode?"productnode":"node";})
      .attr("id", function(d){return d.id;})
      .attr("r", function(d){return d.productnode?productnodeRadius:nodeRadius;});

  force.start();
  showDot();
 }
 return 0;
} // end of restart function

// Make a list (array) of (the indices of) nodes in the nth subgraph
function subgraph(n){
 subG = new Array;
 for (var i=0;i<nodes.length;i++){
  if (nodes[i].subgraph==n){
   subG.push(i);
  }
 }
 return subG;
} // end of subgraph function

// Construct the DOT language version of the graphs (free product graph and, optionally, the protographs)
function constructDot(){
 var Gdot = "";
 Gdot += "graph Gproto {\n";
 Gdot += "\tsplines=line;\n\n";

 // settings
 var includeprotographs = document.getElementById("theincludeprotographs").checked;
 var labelprotographs = document.getElementById("thelabelprotographs").checked;
 var protographcolours = document.getElementById("theprotographcolours").checked;

// var showlabels = true;

 // print out the protographs?
 if (includeprotographs){
  Gdot += "\t// protographs\n";
  for (var n=0;n<Ngraphs;n++){ // loop over all *extant* subgraphs
   if (subgraphNodes[n].length){
    Gdot += "\tsubgraph cluster_"+n+" {\n\t\tlabel = \"Protograph "+n+"\";\n";
    // print the node labels:
    if (labelprotographs){
     for (var i=0;i<subgraphNodes[n].length;i++){ // loop over all nodes in this subgraph
//      Gdot += "\t\t"+ i +" [ label = \""+n+"."+ i +"\"];\n"; // make lables as "n.i"
//      Gdot += "\t\t"+ i +" [ label = \""+ i +"\"];\n"; // make labels as "i"
      Gdot += "\t\t"+ i +" [ label = \""+  alphabet[n][i] +"\"];\n"; // make labels using the nth alphabet
     }
    }
    // print the edges: we need to make these unique wrt other protographs AND the final graph...
    for (var i=0;i<links.length;i++){
     if (links[i].source.subgraph == n && links[i].target.subgraph == n){
      Gdot += "\t\t"+ links[i].source.index +"--"+ links[i].target.index;
      if (protographcolours){
       Gdot += " [color = " + colours[n] + "]";
      }
      Gdot += ";\n";
     }
    }
    Gdot += "\t}\n";
   }
  }
 } // end includeprotographs
 Gdot += "}\n";

 return Gdot;
}

// Put the DOT language version of the graphs into the appropriate text area on the page
function showDot(){
 var tmpdot = constructDot();
 var htmlGdot = tmpdot.replace(/(\n)/g, "<br/>").replace(/(\t)/g,"&nbsp;&nbsp;&nbsp;&nbsp;");
 // insert the dot code into the page:
// document.getElementById("protographDOT").innerHTML=htmlGdot;
 document.getElementById("protographDOT").value=tmpdot;
}

// Get the DOT language version of the graphs and copy it into the clipboard
 function copyDot(){
//  var src = document.getElementById("protographDOT").innerHTML;
  var src = constructDot();
  function listener(e) {
   e.clipboardData.setData("text/html", src);
   e.clipboardData.setData("text/plain", src);
   e.preventDefault();
  }
  document.addEventListener("copy", listener);
  document.execCommand("copy");
  document.removeEventListener("copy", listener);
 }

function jsProtographs(){
 // This function provides a convenient way to transform the D3 subgraphs, as constructed by the user, into
 //   an array of arrays containing edges (P) and unique labels for each connected node (Plabel).
 //
 // P is an array whose elements, P[n], are themselves arrays, representing the subgraphs 0,...,(n-1)
 // P[n], therefore, is an array of edges, such that P[n][i][0] and P[n][i][1] are the ends of one link,
 //   where the nth subgraph contains i=0,...,m links.
 //
 // set up P and Plabel as global variables
 P = new Array;
 Plabel = new Array;

 // initialise Plabel
 for (var n=0;n<Ngraphs;n++){
  var protoG = subgraph(n); // get the nodes which are in protograph n
  // labels:
  Plabel[n] = new Array;
  for (var i=0;i<protoG.length;i++){
   Plabel[n][i] = alphabet[n][i];
  }
  // edges:
  P[n] = new Array;
  for (var i=0;i<links.length;i++){
   if (links[i].source.subgraph == n && links[i].target.subgraph == n){
//    var tmplink = [links[i].source.index,links[i].target.index];
    var tmplink = [protoG.indexOf(links[i].source.index),protoG.indexOf(links[i].target.index)];
    P[n].push(tmplink);
   }
  } // end loop over links
 } // end loop over protographs (subgraphs)
} // end jsProtgraphs function

// Add some random shifts to node positions (shake them up a little)
function bump(){
 // only act if the free product graph has been drawn
 if (typeof thenewsvg != "undefined") {
  // apply a small perturbation to all node positions in the free product graph
  newnodes.forEach(function(d,i) {
   d.x += (Math.random() - .5) * 20;
   d.y += (Math.random() - .5) * 20;
  });
  newforce.resume();
 }
 return 0;
}

/* **************************************************************************** */
// Construct a free product from the protographs
function freeProductGraph(maxDepth=1,showupdate=false,includeprotographs=true){
 var t0 = performance.now();
 var debug = false;

 var showedgecolours = true; // make these TRUE for now: are they only used (below) for the DOT output?
 var showlabels = true;

 jsProtographs(); // creates P and Plabel

 // Set up arrays to hold node information:
 var I = new Array; // node index (unique integer label for each node)
//REMOVE  L = new Array; // node address (?)
  U = new Array; // the node's "update function"
  A = new Array; // the node's address
 var nodeInProtograph = new Array; // which protograph each new node is added as part of
 var isdone = new Array;
 var colours = ["red","blue","green","hotpink","yellow","darkorange","gold","forestgreen","grey75"];
 U[0] = new Array(P.length);
 for (var i=0;i<P.length;i++){
  U[0][i] = 0; // default update function for the root node is just all zeros (ie. ***the base node for each protograph***)
 }
 I[0]=0;
//REMOVE L[0]="root";
 A[0] = "";
 nodeInProtograph[0] = -1; // the root node is not really part of any protograph, and we want to add all protographs to it
 isdone[0] = false; // initialise the root node as "not finished"

 // initialise the final graph, G:
 //   each entry G[i] is an edge (connecting nodes G[i][0] and G[i][1]), in protograph G[i][2] (for, eg., colouring edges), at depth G[i][3] (distance from the root node)
  G = new Array;

 for (var depth=0;depth<maxDepth;depth++){
  // Find all unfinished nodes at the preceeding depth, according to "isdone":
  var usenodes = new Array;
  for (var i=0;i<isdone.length;i++){
   if (!isdone[i]){
    usenodes.push(i);
   }
  }

  // Actual work on this depth starts here:
  for (var k=0;k<usenodes.length;k++){
   var thisnode = usenodes[k];

   /*
    To add the required protograph, we need to add all of its edges
    - *except* for the attaching node
    - each protograph node will become a *new node in G*

    The new nodes created at each step will be the whole set of nodes of each protograph
   */

   for (var n=0;n<P.length;n++){ // loop over all the protographs
    if (nodeInProtograph[thisnode]==n){
     // we won't add a protograph to a node that is already part of that protograph
     if (debug) console.log("Skipping adding its own protograph (protograph "+n+") to node "+thisnode);
    } else {

     if (debug) console.log("  Adding nodes from protograph "+n);
     var addnodes = new Array(P[n].length); // store the new node indices for this protograph
     // We need to loop over all this protograph's nodes and create them, before adding edges to G:
     for (var i=0;i<Plabel[n].length;i++){ // loop over all the nodes for *this* protograph (we don't use Plabel yet, but just need its length)
      if (debug) console.log("    Protograph "+n+": node "+i+" (label \""+Plabel[n][i]+"\")");
      if (i==U[thisnode][n]){ // this is the attachment point for this protograph, don't add a node or an address
       // do nothing except put the attachment point into the copy of the protograph
       addnodes[i] = thisnode;
      } else { // this is NOT the protograph attachement point, so go ahead and add a node:
       /*
        1. create a new node
        2. work out its index I
        3. set its update function U
        4. set its address (address of "thisnode" with the changed element of the new update fn appended)
       */
       addnode = I.length;
       I[I.length] = addnode; // (unique) index of the new node (we're just incrementing it)
//REMOVE       L[I.length] = ""+Plabel[n][i]; // (prepend "" to cast to string) node address: the address of the node this one is attached to, plus ...???
//REMOVE       if (debug) console.log("Created node I="+I[I.length-1]+" with L[] = "+L[I.length]);
       addnodes[i] = addnode;
       isdone[addnode] = false;
       nodeInProtograph[addnode] = n;

       // initialise the update function U for this new node:
       U[addnode] = new Array(P.length);
       for (var m=0;m<P.length;m++){
        U[addnode][m] = U[thisnode][m]; // for now, just copy U from the "parent" (thisnode)
       }
       U[addnode][n] = i; // but change the entry for this protograph (the nth one)

       /*
         From the update function of the new node we can work out its address
         1. which element (t, say) of the update function changed between U[thisnode] (the attachment point) and U[addnode]?
         2. what is the value of that element?  ie. U[addnode][k]
         3. append that value to the address of "thisnode"
       */
        A[addnode] = ""; // initialise
        for (var t=0;t<U[thisnode].length;t++){
         if (U[thisnode][t]!=U[addnode][t]){
          A[addnode] = A[thisnode] + alphabet[n][U[addnode][t]]; // append the changed value to the attachment node's address [nb. addnode is in the protograph n]
          if (debug) console.log("Update function changed in position "+t+" to a value of "+U[addnode][t]);
         }
        }
        if (A[addnode].length==0){
         console.log("WARNING: a node was added but its address seems to be empty");
        }

      }
     }

     /* Now that all the nodes for this protograph have been added, we must
      1. add its edges to G as required
      2. ...but replace the attaching node with the index of thisindex
      3. ...and replace each node's index (in the protograph) with the index of the newly created node

      ie.

      1. loop over this protograph's edges
      2. use addnodes as an index into the edge definitions

     */

     Nedges = G.length; // size of G so far
     for (var i=0;i<P[n].length;i++){ // now loop over all the *edges* this protograph
      G[Nedges+i] = new Array(2); // initialise the new edge in G
      G[Nedges+i][0] = addnodes[P[n][i][0]]; // these are the node indices of the newly created edge, using the newly created nodes
      G[Nedges+i][1] = addnodes[P[n][i][1]]; //  and the other end of the newly-added edge
      G[Nedges+i][2] = n; // this edge lies in protograph n
      G[Nedges+i][3] = depth; // this edge was added as part of this "depth"
      if (debug) console.log("G[end] = ["+G[G.length-1][0]+", "+G[G.length-1][1]+"]");
     }
    } // end of "if nodeInProtograph==n" check
   } // loop over protographs

   // All required protographs have been added to the working node ("thisnode"), so it is finished:
   isdone[thisnode] = true;
  }  // depth loop ends here

 }


 // Want to create this free product graph in d3?
 // G contains the required links...
 var makeD3 = true;
 if (makeD3){
  if (typeof thenewsvg != "undefined") {
   console.log("Removing old free product graph");
   thenewsvg.remove();
  }

  newforce = d3.layout.force()
      .size([outputWidth, outputHeight])
      .charge(-200) // strength of repulse between nodes
      .linkDistance(10)
      .gravity(0) // set to zero and set a custom gravity function in newtickfn
      .on("tick", newtickfn)

  var newdrag = newforce.drag()
                        .on("dragstart", newdragstartfn);

  thenewsvg = d3.select("#graphareaFreeProduct").append("svg")
                .attr("id", "thefreeproductgraph")
                .attr("class", "shadowed")
                .attr("width", outputWidth)
                .attr("height", 0) // temporarily zero: we'll slide it into view
                .on("mousemove", newmousemovefn)
                .on("mouseenter", newmouseenterfn)
                .on("mouseout", newmouseoutfn)
                .on("DOMMouseScroll", mousewheelfn);

  // animate the new SVG's height to make the element appear smoothly
  d3.select("#thefreeproductgraph").attr("height",0).transition().duration(500).attr("height",outputHeight);

  newnodes = newforce.nodes(); // starts out empty
  newlinks = newforce.links();

  var thenewcursor = thenewsvg.append("circle")
                     .attr("id", "thenewcursor")
                     .attr("r", cursorRadius)
                     .attr("transform", "translate(-100,-100)")
                     .attr("class", "cursor");


  // loop through G (which is the array of edges) and create a list of unique nodes
  var Gnodes = new Array;
  for (var i=0;i<G.length;i++){
   for (var j=0;j<2;j++){ // check search the "from" and "to" nodes, ie. the ends of this edge (ie. G[i][0] and G[i][1])
    if (Gnodes.indexOf(G[i][j])==-1){ // not found? add it to the node list
     Gnodes.push(G[i][j]);
     var newcx = outputWidth/2;
     var newcy = outputHeight/2;
     var newx = newcx;
     var newy = newcy;
     var newUnode = U[G[i][j]]; // this is the update function for this node, in its raw form (an array)

//     var newtitle = "U={"+U[G[i][j]]+"}"; // basic, untranslated label
     var newtitle = "";
     // translate the new node's update function into the alphabets for the extant subgraphs:
     newtitle += "{"; // adjust to taste, perhaps prepend "U="
     for (var m=0;m<newUnode.length;m++){
      if (P[m].length){ // only show entries for extant protographs
       newtitle += Plabel[m][newUnode[m]] + ","; // the update function contains P.length components (one for each protograph)
      }
     }
     // remove trailing comma
     newtitle = newtitle.replace(/,$/,"");
     newtitle += "}";

     var newaddress = A[G[i][j]];

     /* ********** starting to create this node ********** */
     /* ********** starting to create this node ********** */
     /* ********** starting to create this node ********** */
     // add the new node, including its position, centre-of-attraction, which subgraph it is in, which "depth" it is at and its title (ie. update function):
     newnodes.push({
      x: newx,
      y: newy,
      cx: newcx,
      cy: newcy,
      subgraph: null, // not really applicable; nodes will always (once "done") be part of two protographs... (perhaps append both of them here)
      depth: G[i][3],
      productnode: true,
      title: newtitle, // THIS IS WHERE THE NODE LABEL IS SET
      address: newaddress,
     });

     // and an id:
     if (G[i][j]==0){ // root node of the free product graph
      newnodes[newnodes.length-1].id="rootnode";
     } else { // regular node of the free product graph:
      newnodes[newnodes.length-1].id="node"+newnodes.length; // just give non-root nodes a numeric ID for now
     }

     // fix the root node in place if desired:
     var usefixedroot = document.getElementById("thefixrootnodeFP").checked;
     if (G[i][j]==0){ // is this the root node of the free product graph?
      if (usefixedroot){ // do we want it to be fixed? [formerly stickyrootnode]
       newnodes[newnodes.length-1].fixed = true; // then set its fixed property to true
      }
     }
     /* ********** finished creating this node ********** */
     /* ********** finished creating this node ********** */
     /* ********** finished creating this node ********** */

    }
   }
  }

  /* ********** creating edges ********** */
  // now loop through G and join the new nodes according to its edges 
  for (var i=0;i<G.length;i++){
   var thislink = {source:Gnodes[G[i][0]], target:Gnodes[G[i][1]], productlink:true, subgraph:G[i][2], depth:G[i][3]};
   newlinks.push(thislink);
  }

  /* ********** set the physics in motion ********** */
  newrestart();
 }



 // initialise the variable which will hold the final graph in the DOT language
 var Gdot = "";

 /* output G in the DOT language */
 Gdot += "graph G {\n"; // start of the graph definition
 Gdot += "\tsplines=line;\n\n"; // enforce straight lines for the protographs (could use "curved" (?))

 // print out the protographs?
 if (includeprotographs){
  Gdot += "\t// protographs\n";
  for (var n=0;n<P.length;n++){
   Gdot += "\tsubgraph cluster_"+n+" {\n\t\tlabel = \"Protograph "+n+"\";\n";
   // first the edges: we need to make these unique wrt other protographs AND the final graph...
   for (var j=0;j<P[n].length;j++){
    Gdot += "\t\t"+ P[n][j][0] +"--"+ P[n][j][1]
    if (showedgecolours){
     Gdot += " [color = " + colours[n] + "]";
    }
    Gdot += ";\n";
   }
   Gdot += "\n";
   // then the node labels:
   if (showlabels){
    for (var j=0;j<Plabel[n].length;j++){
     Gdot += "\t\t"+ j +" [ label = \""+ Plabel[n][j] + "\"];\n";
    }
   }
   Gdot += "\t}\n";
  }
 } // end includeprotographs

 // Now the final graph; first the edges:
 Gdot += "\n\t// Final graph:\n";
 for (var i=0;i<G.length;i++){
  Gdot += "\t" + G[i][0] + "--" + G[i][1]; // +";\n";
  if (showedgecolours){
   if (nodeInProtograph[G[i][1]]>=0){ // are we joining to the root node?
    Gdot += " [color = " + colours[nodeInProtograph[G[i][1]]] + "]";
   } else {
    Gdot += " [color = " + colours[nodeInProtograph[G[i][0]]] + "]"; // for the root node (nodeInProtograph is -1), use the other end's colour
   }
  }
  Gdot += ";\n";
 }
 Gdot += "\n";

 // and then list the nodes with their labels:
 if (showlabels){
  for (var i=0;i<I.length;i++){
   Gdot += "\t" + I[i] + " [ label = \""; // set up the label entry
   if (showupdate){ // ... and "update function", if required
//    Gdot += "U="; // want this?
    Gdot += "{";
    for (var n=0;n<P.length;n++){
     if (P[n].length){ // only show entries for extant protographs
      Gdot += Plabel[n][U[i][n]] + ","; // the update function contains P.length components (one for each protograph)
     }
    }
    // remove trailing comma
    Gdot = Gdot.replace(/,$/,'');
    Gdot += "}";
   } else {
    Gdot += i;
   }
   Gdot += "\" ";
   if (i==0){
    Gdot += "style=filled fillcolor=grey"; // colour the "root" node differently to other nodes
   }
   Gdot += "];\n";
  }
 }

 Gdot += "}\n"; // end of the graph definition

 var t1 = performance.now();
 if (debug) console.log("Call to freeProductGraph("+maxDepth+") took " + (t1 - t0) + " milliseconds.");
 return Gdot;
}



/* **************************************************************************** */
// Display the graph in DOT language on the page (in the "freegraphDOT" element)
function printGraph(G=""){
 var debug = false;

 // find the target element
 var freegraphDOT = document.getElementById("freegraphDOT");

 // For convenience, check what element type we are putting the output into,
 // so that we can reformat linebreaks as appropriate
 if (freegraphDOT.nodeName=="TEXTAREA"){
  var output = G.replace(/\r\n|\r|\n/g,"\r\n");
  freegraphDOT.value = output; // when "freegraphDOT" is a textarea
 } else if (freegraphDOT.nodeName=="DIV"){
  var output = G.replace(/\r\n|\r|\n/g,"&#13;&#10;");
  freegraphDOT.innerHTML = output; // when "freegraphDOT" is a div
 } else {
  // Not a textarea or div?  Fail silently
  if (debug) console.log("Cannot find freegraphDOT element to paste the graph into!");
 }
 return 0;
}


/* **************************************************************************** */
// Check the user-selected settings and then make the appropriate free product graph (eg. with desired depth)
function makeFreeProductGraph(){
 if (typeof thenewsvg != "undefined") {
  removeProductGraph();
 }
 var debug = false;
 if (debug) var t0 = performance.now();
 var maxDepth = document.getElementById("thedepth").value;
 var showupdatefn = document.getElementById("thelabelprotographs").value;
// var showupdatefn = theshowupdate.checked;
 var includeprotographs = theincludeprotographs.checked;

 var G = freeProductGraph(maxDepth,showupdatefn,includeprotographs);
 printGraph(G);

 var t1 = performance.now();
 if (debug) console.log("Call to makeFreeProductGraph() took " + (t1 - t0) + " milliseconds.");
 return 0;
}


/* **************************************************************************** */
// Delete the existing free product graph (and it's edges and the SVG which it sits in)
function removeProductGraph(){
 // not perfect, but this works sufficiently: still a bit of a problem with repulsion due to "deleted" nodes
 // -- should we use .exit() ? see, eg., https://www.d3indepth.com/enterexit/
 d3.selectAll(".productnode");
 d3.selectAll(".productnode").remove();
 d3.selectAll("g").remove();
 thenewsvg.selectAll(".productnode").remove();
 thenewsvg.selectAll(".productlink").remove();
 thenewsvg.selectAll("g").remove();
 return 0;
}

// Draw the nodes, edges and text labels for the free product graph
function newrestart(){
 // only act if the free product graph (in the "thenewsvg" element) exists:
 if (typeof thenewsvg != "undefined") {
  // see what options the user has chosen with the page controls:
  var useboundary = document.getElementById("theboundaryFP").checked;
  var useedgecolours = document.getElementById("theedgecoloursFP").checked;
  var useopacity = document.getElementById("theopacityFP").checked;
  var usefixedroot = document.getElementById("thefixrootnodeFP").checked;
  var usethickness = document.getElementById("thethicknessFP").checked;
  var maxDepth = document.getElementById("thedepth").value;

  // set the physics forces according to what the user has set on the page:
  newforce.charge(-document.getElementById("thecharge").value);      // repulsion
  newforce.linkDistance(document.getElementById("thespread").value); // springs

  /* ********** set up the links as SVG objects: ********** */
  /* ********** set up the links as SVG objects: ********** */
  /* ********** set up the links as SVG objects: ********** */
  var newlink = thenewsvg.selectAll(".productlink").data(newlinks);
  newlink.enter().insert("line", ".node")
         .attr("class", "productlink")
         .style("display", "initial") // not needed?
         .attr("ondisplay",true) // a variable for us to check which objects are supposed to be showing (visible)
         .attr("id", function(d,i){ return "link_"+ newlinks[i].source +"_"+ newlinks[i].target;} )
         .style("stroke-width", function(d,i){ return setThickness(newlinks[i].depth,newlinks[i].subgraph);} )
         .style("stroke", function(d,i){ return setEdgecolour(newlinks[i].subgraph); })
         .style("stroke-opacity", function(d){ return (useopacity?1.0/d.depth:1); });


  /* ********** set up the nodes as SVG objects: ********** */
  /* ********** set up the nodes as SVG objects: ********** */
  /* ********** set up the nodes as SVG objects: ********** */
  var newnode = thenewsvg.selectAll("g").data(newnodes); // add a group for each node (each group will shortly contain a circle and a text label)
  var newnodeEnter = newnode.enter()
                            .append("g")
                            .call(newforce.drag);

  // ADD A CIRCLE TO REPRESENT THE NODE
  newnode.enter()
         .append("circle")
         .attr("r", productnodeRadius)
         .attr("class", "productnode")
         .attr("id", function(d){return d.id;} )
         .on("dblclick", newdblclickNodefn)
         .on("mousemove", mousemovefn)
         .style("display", "initial")
         .attr("ondisplay",true)
         .style("fill-opacity", function(d){ return (useopacity?1.0/d.depth:1); })
         .style("stroke-opacity", function(d){ return (useopacity?1.0/d.depth:1); })
         .call(newforce.drag);

  // ADD A TEXT LABEL CONTAINING THE NODE'S UPDATE FUNCTION
  newnode.enter()
         .append("text")
         .attr("class", "productupdatefn")
         .attr("display", "none")
          .attr("ondisplay",false)
         .style("text-anchor", "end") // start, middle or end
         .style("pointer-events", "none") // none or auto // mainly this is so that the text labels don't get in the way of dragging nodes
         .text(function(d){return d.title;});

  // ADD A TEXT LABEL CONTAINING THE NODE'S ADDRESS
  newnode.enter()
         .append("text")
         .attr("class", "productaddress")
         .attr("display", "none")
         .attr("ondisplay",false)
         .style("text-anchor", "start") // start, middle or end
         .style("pointer-events", "none") // none or auto // mainly this is so that the text labels don't get in the way of dragging nodes
         .text(function(d){return ""+(d.address.length?d.address:"\u{d8}");}); // if d.address is undefined, this label object causes problems for bounds()...

  /* ********** put the DOT format text in its place on the page ********* */
  showDot();

  /* apply the control settings */
  showAllLabels();

  /* ********** now run the physics simulation ********* */
  newforce.start();
 }
 return 0;
}

// tick function for the free product graph (runs the graph physics at each timestep)
function newtickfn(e){
 // see what options the user has chosen with the page controls:
 var useboundary = document.getElementById("theboundaryFP").checked;
 var useedgecolours = document.getElementById("theedgecoloursFP").checked;
 var useopacity = document.getElementById("theopacityFP").checked;
 var usefixedroot = document.getElementById("thefixrootnodeFP").checked;
 var usethickness = document.getElementById("thethicknessFP").checked;
 var maxDepth = document.getElementById("thedepth").checked;

 var newlink = thenewsvg.selectAll(".productlink");
 newlink.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; })
        .style("stroke", function(d){return setEdgecolour(d.subgraph);})
        .style("stroke-width", function(d,i){ return setThickness(d.depth,d.subgraph);} )
        .style("stroke-opacity", function(d){ return (useopacity?1.0/d.depth:1); });

 // the node itself:
 var newnode = thenewsvg.selectAll(".productnode");
 newnode.each(newgravityfn(0.2*e.alpha));

 newnode.style("fill-opacity", function(d){ return (useopacity?1.0/d.depth:1); })
        .style("stroke-opacity", function(d){ return (useopacity?1.0/d.depth:1); });
 // How to fix the root node when the control is changed?
 // -- this isn't working:
 newnode.attr("fixed", function(d){ return (d.id=="rootnode"&usefixedroot?"true":"false"); });

 newnode.attr("cx", function(d) { return (useboundary? d.x = Math.max(nodeRadius, Math.min(outputWidth - nodeRadius, d.x)) : d.x); })
        .attr("cy", function(d) { return (useboundary? d.y = Math.max(nodeRadius, Math.min(outputHeight - nodeRadius, d.y)) : d.y); });

 // the node update function text:
 var newtext = thenewsvg.selectAll(".productupdatefn");
 newtext.each(newgravityfn(0.2*e.alpha));
 newtext.attr("dx", function(d) { return (useboundary? d.x = Math.max(nodeRadius, Math.min(outputWidth - nodeRadius, d.x)) : d.x + updatefnDeltaX); })
        .attr("dy", function(d) { return (useboundary? d.y = Math.max(nodeRadius, Math.min(outputHeight - nodeRadius, d.y)) : d.y + updatefnDeltaY); });

 // the node address text:
 var newtext = thenewsvg.selectAll(".productaddress");
 newtext.each(newgravityfn(0.2*e.alpha));
 newtext.attr("dx", function(d) { return (useboundary? d.x = Math.max(nodeRadius, Math.min(outputWidth - nodeRadius, d.x)) : d.x + addressDeltaX); })
        .attr("dy", function(d) { return (useboundary? d.y = Math.max(nodeRadius, Math.min(outputHeight - nodeRadius, d.y)) : d.y + addressDeltaY); });

 // the node group:
 var newnodegroup = thenewsvg.selectAll("g");
 newnodegroup.each(newgravityfn(0.2*e.alpha));
 newnodegroup.attr("cx", function(d) { return (useboundary? d.x = Math.max(nodeRadius, Math.min(outputWidth - nodeRadius, d.x)) : d.x); })
             .attr("cy", function(d) { return (useboundary? d.y = Math.max(nodeRadius, Math.min(outputHeight - nodeRadius, d.y)) : d.y) });

 return 0;
}

// set the dragging activity for the free product graph: normal dragging or making nodes fixed
function newdragstartfn(d) {
 if (event.shiftKey) {
  d3.select(this).attr("r",2*productnodeRadius); // make it stand out
  d3.select(this).classed("fixed", d.fixed = true);
 } else {
  // dragging without the shift key just drags, it doesn't set the node to "fixed"
  // -- so do nothing here
 }
 return 0;
}

// Double-clicking on a node toggles its "fixed" statusw
function newdblclickNodefn(d,i) {
 if (d.fixed){
  d3.select(this).attr("r",productnodeRadius); // back to normal size!
  d3.select(this).classed("fixed", d.fixed = false);
 } else {
  d3.select(this).attr("r",2*productnodeRadius); // back to normal size!
  d3.select(this).classed("fixed", d.fixed = true);
 }
 newrestart();
 return 0;
}

// Set the class of an SVG object so that its label can be seen (using CSS)
function showLabel(d,i){
 d3.select(this).attr("class", "productnode examinenode");
// console.log(d.title);
 return 0;
}

// Remove the class of an SVG object so that its label can no longer be seen
function hideLabel(d,i){
 d3.select(this).attr("class", "productnode");
 return 0;
}

// Moving the mouse around the free product graph highlights nodes and also displays nearby node labels
function newmousemovefn(){
 var thenewcursor = d3.select("#thenewcursor");
// thenewcursor.attr("transform", "translate(" + d3.mouse(this) + ")");
  thenewcursor
    .attr("display", "initial")
    .attr("ondisplay",true)
    .attr("transform", "translate(" + d3.mouse(this) + ")");

 var point = d3.mouse(this);
 var x=Math.round(point[0]);
 var y=Math.round(point[1]);
 var nearbyRange = thenewcursor.attr("r");
 d3.selectAll(".productnode")
    .style("fill", "") // first revert the fill colour of all productnodes to the CSS-defined value
    .filter(function(d){ // then filter on "nearby" nodes and show their label
     var dist = Math.sqrt(Math.pow(d.x - x,2)+Math.pow(d.y - y,2));
     return dist < nearbyRange;
    })
    .style("fill", "white");

 /*
    When the mouse moves around, see if it is close to any nodes and,
    if requested in the controls, show those nodes' labels (ie. on hover).
 */
// var usehoverlabels = document.getElementById("thehoverlabelsFP").checked;
 var alwaysshowlabels = document.getElementById("theshowlabelsFP").checked; // off=hover, on=always
 var labeltype = document.getElementById("thelabeltype").value;

 if (!alwaysshowlabels & allowedLabels.indexOf(labeltype) > -1){
  d3.selectAll(".product"+labeltype)
     .style("display", "none") // hide all node labels
     .attr("ondisplay",false)
     .filter(function(d){ // then filter on "nearby" nodes and show their label
       var dist = Math.sqrt(Math.pow(d.x - x,2)+Math.pow(d.y - y,2));
       return dist < 1.5*productnodeRadius; // only very close labels (almost always only one)
     })
     .attr("ondisplay",true)
     .style("display", "initial");
 }
// newrestart();
}

function showAllLabels(){
 if (typeof thenewsvg != "undefined") {
  var alwaysshowlabels = document.getElementById("theshowlabelsFP").checked; // off=hover, on=always
  var labeltype = document.getElementById("thelabeltype").value;

  if (alwaysshowlabels & allowedLabels.indexOf(labeltype) > -1){
   hideAllLabels(); // to clear any other label type
   d3.selectAll(".product"+labeltype)
     .style("display", "initial") // show all node labels
     .attr("ondisplay",true);
  } else {
   hideAllLabels();
  }
 }
 return 0;
}

function hideAllLabels(){
 if (typeof thenewsvg != "undefined") {
  for (i=0;i<allowedLabels.length;i++){
   d3.selectAll(".product"+allowedLabels[i])
      .style("display", "none") // hide all node labels
      .attr("ondisplay",false)
  }
 }
}
// Show the "cursor" when the mouse enters the graph area
function newmouseenterfn(){
 if (typeof thenewsvg != "undefined") {
  d3.select("#thenewcursor")
    .attr("display", "initial")
    .attr("ondisplay",true);

// OR HIDE IT:
//  d3.select("#thenewcursor")
//    .attr("display", "none");
//    .attr("ondisplay",false);
 }
}

// Revert the appearance of all nodes to normal when the mouse leaves the graph area (instead of some being highlighted)
function newmouseoutfn(){
 if (typeof thenewsvg != "undefined") {
  // revert the fill colour of all productnodes to the CSS-defined value (the highlighted ones)
  d3.selectAll(".productnode")
    .style("fill", "")
  // hide the "cursor" when the mouse leaves the graph area
  d3.select("#thenewcursor")
    .attr("display", "none")
    .attr("ondisplay",false);
 }
 return 0;
}

// hide the "cursor" when the mouse leaves the free product graph area
function mouseoutfn(){
 d3.select("#thecursor")
   .attr("display", "none")
   .attr("ondisplay",false);
 return 0;
}

// show the "cursor" when the mouse enters the free product graph area
function mouseenterfn(){
 d3.select("#thecursor")
   .attr("display", "initial")
   .attr("ondisplay",true);
 return 0;
}

// Set the edge thickness for the free product graph, based on the user controls
function setThickness(depth=0,subgraph=0){
 var usethickness = document.getElementById("thethicknessFP").checked;
 var maxDepth = document.getElementById("thedepth").value;
 return (usethickness?Math.max(1,maxDepth - depth):2*(1+subgraph));
}

// Set the edge colours for the free product graph, based on the user controls
function setEdgecolour(subgraph=0){
 var useedgecolours = document.getElementById("theedgecoloursFP").checked;
 var usealtcolours = false;
 if (usealtcolours){
  return d3colours(subgraph);
 } else {
  return (useedgecolours?colours[subgraph]:"#000");
 }
 return 0;
}

// Update the gravity parameter (for use with the "antigravity" switch)
function setAntigravity(){
 var antigrav = document.getElementById("theantigravFP").checked;
 if (antigrav){
  newforce.gravity(-0.6);
 } else {
  newforce.gravity(0);
 }
 return 0;
}

// function to save the free product graph as a PDF file
function savePDF(){
 var saveBounds = bounds();
 var pdfwidth = Math.ceil(saveBounds.maxX-saveBounds.minX);
 var pdfheight = Math.ceil(saveBounds.maxY-saveBounds.minY);
 var xoff = -saveBounds.minX;
 var yoff = -saveBounds.minY;
 var layout = "portrait";

 if (pdfwidth>pdfheight) layout="landscape";
 var thepdf = new jsPDF(layout, "pt", [pdfheight, pdfwidth]);

 // This produces a PDF which is approx. 33% larger than on screen;
 // changing "scale" to 75% broke the offsets and/or width-height, so revisit that later.
 // -- this is because scale is applied before offsets, so the offsets need to be recalculated...
 document.getElementById("thefreeproductgraph").classList.remove("shadowed");
 svg2pdf(document.getElementById("thefreeproductgraph"), thepdf, {
         xOffset: xoff,
         yOffset: yoff,
         scale: 1,
 });
 thepdf.save("graph.pdf");
 document.getElementById("thefreeproductgraph").classList.add("shadowed");
 return 0;
}

// function to save the free product graph as a PNG file
function savePNG(){
 // For options see https://github.com/exupero/saveSvgAsPng
 var transparentBG = document.getElementById("thetransparencybutton").checked;

 var saveBounds = bounds();
 var saveOptions = {
  scale: 2.0, // larger, better quality
  backgroundColor: (transparentBG?"#fff0":"#fff"), // transparent or not
  left: saveBounds.minX,
  top: saveBounds.minY,
  width: saveBounds.maxX-saveBounds.minX,
  height: saveBounds.maxY-saveBounds.minY,
 };
 document.getElementById("thefreeproductgraph").classList.remove("shadowed"); // works
 saveSvgAsPng(document.getElementById("thefreeproductgraph"), "graph.png", saveOptions);
 setTimeout(() => { document.getElementById("thefreeproductgraph").classList.add("shadowed"); }, 100); // this is enough delay for saveSvgAsPng to finish
// document.getElementById("thefreeproductgraph").classList.add("shadowed"); // restored too soon, PNG still contains the shadow
}

// function to get the bounding box of the SVG elements in the free product graph
function bounds(){
 var minX = Number.POSITIVE_INFINITY;
 var maxX = Number.NEGATIVE_INFINITY;
 var minY = Number.POSITIVE_INFINITY;
 var maxY = Number.NEGATIVE_INFINITY;

 var showlabels = document.getElementById("theshowlabelsFP").checked; // off=hover, on=always
 var labeltype = document.getElementById("thelabeltype").value; // none, updatefn, address
 var uselabels = showlabels & labeltype!="none";

 // Loop over the children (nodes, edges, text labels) of the graph
 //  -- we don't do anything for links, since (for now) their end nodes are always represented
 //  -- if nodes were hidden we would need to test links too
 var svgchildren=document.getElementById("thefreeproductgraph").children;
 for (var i=0;i<svgchildren.length;i++){
   switch (svgchildren[i].nodeName){
    case "circle": // a node
     if (svgchildren[i].id!="thenewcursor"){ /* ignore the cursor when calculating bounds */
      var bbox = getTransformedBBox(svgchildren[i]);
      var circleX = parseFloat(bbox.x); // left
      var circleY = parseFloat(bbox.y); // top (on screen)
      var circleW = parseFloat(bbox.width);
      var circleH = parseFloat(bbox.height);
      if ((circleX)<minX)         minX=(circleX);
      if ((circleX+circleW)>maxX) maxX=(circleX+circleW);
      if ((circleY)<minY)         minY=(circleY);
      if ((circleY+circleH)>maxY) maxY=(circleY+circleH);
     }
     break;
    case "text": // a label
     if (uselabels){
      if (svgchildren[i].attributes.ondisplay.value=="true"){
       var bbox = getTransformedBBox(svgchildren[i]);
       var textX = parseFloat(bbox.x); // left
       var textY = parseFloat(bbox.y); // top (on screen)
       var textW = parseFloat(bbox.width);
       var textH = parseFloat(bbox.height);
       if ((textX)<minX)       minX=(textX);
       if ((textX+textW)>maxX) maxX=(textX+textW);
       if ((textY)<minY)       minY=(textY);
       if ((textY+textH)>maxY) maxY=(textY+textH);
      }
     }
     break;
   } // end switch
 }

 minX=Math.floor(minX);
 maxX=Math.ceil(maxX);
 minY=Math.floor(minY);
 maxY=Math.ceil(maxY);

 return {minX, maxX, minY, maxY};
}

// get transformed bounding box
// Thanks Ian: https://stackoverflow.com/a/44197345
function getTransformedBBox(obj){
 var tr = obj.getCTM();
 try{
  var bbox0 = obj.getBBox();
 }
 catch(err){
  var bbox0 = [0,0,0,0];
  if (err.message.length) console.log(err.message);
 }
 var bbox1 = [];
 var corners0 = [
   matrixXY(tr,bbox0.x,bbox0.y),
   matrixXY(tr,bbox0.x+bbox0.width,bbox0.y),
   matrixXY(tr,bbox0.x+bbox0.width,bbox0.y+bbox0.height),
   matrixXY(tr,bbox0.x,bbox0.y+bbox0.height) ];
 bbox1.x = Number.POSITIVE_INFINITY;
 bbox1.y = Number.POSITIVE_INFINITY;
 bbox1.width = Number.NEGATIVE_INFINITY;
 bbox1.height = Number.NEGATIVE_INFINITY;

 // get the left,top,width,height like getBBox()
 for (var i=0;i<4;i++){
  if (corners0[i].x<bbox1.x) bbox1.x = corners0[i].x;
  if (corners0[i].y<bbox1.y) bbox1.y = corners0[i].y;
 }
 for (var i=0;i<4;i++){
  if ((corners0[i].x-bbox1.x)>bbox1.width)  bbox1.width  = corners0[i].x-bbox1.x;
  if ((corners0[i].y-bbox1.y)>bbox1.height) bbox1.height = corners0[i].y-bbox1.y;
 }

 return bbox1;
}

// Calculate matrix product
// Thanks Ian: https://stackoverflow.com/a/44197345
function matrixXY(m,x,y) {
 return { x: x * m.a + y * m.c + m.e, y: x * m.b + y * m.d + m.f };
}
