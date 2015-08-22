//Author: Hayo Bart
//August 2015
//Project: Information Graphs Modelling Diabetes Disease
//MSc Information Studies
//Track: Business Information Systems
//University of Amsterdam

// hide the concept- and linkdetail boxes on pageload, since they aren't supposed to show anything
$("#conceptdetails").hide();
$("#linkdetails").hide();

var initializeCUI = "C0011860"
var nodes = [];
var links = [];

var graphURL = "http://purl.org/net/fcnmed/";

// we only want to load the CSV with semantic types once
var loadSemTypeCSV = once(function() {

    // create a parser for a csv file that parses values based on ";"
    var dsv = d3.dsv(";", "text/plain");

    // parse the file
    dsv("./csv/semtypes.csv", function(error, data)
    {
        //console.log("complete")
        // store the data in a global variable such that it is available outside the function
        semTypeJSON = data;

        categoryList = generateCategoryList();

        generateSideBarCategoryLegend(categoryList);

        legendHeight = $("#accordion").outerHeight();

        initializeSVG();
    })

});

// load the CSV to make sure it is available once we reach the populateSideBar() function
loadSemTypeCSV();

function initializeSVG()
{
    svgWidth = d3.select("#graph_wrapper").node().getBoundingClientRect().width;
    svgHeight = window.innerHeight - d3.select(".navbar").node().getBoundingClientRect().height;

    svg = d3.select("#graph_wrapper").append("svg")
            .attr("class", "graph")
            .attr("width", svgWidth)
            .attr("height", svgHeight)

            // code required for zooming and panning the graph, courtesy of http://jsfiddle.net/nrabinowitz/QMKm3/
            .attr("pointer-events", "all")
            .append("g")
            .call(d3.behavior.zoom().on("zoom", redraw))

            // disable double clicking for zooming as this is already associated with another action in our graph
            .on("dblclick.zoom", null)
            .append("g");

    // code required for zooming and panning the graph, courtesy of http://jsfiddle.net/nrabinowitz/QMKm3/
    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .style("fill", "none");

    generateMarker();

    setNodeToolTip();
    setLinkToolTip();

    force = d3.layout.force()
              .size([svgWidth, svgHeight])
              .linkDistance(svgWidth / 7.5)
              .charge(-750);

    getStatements(initializeCUI, 0);
    //getNodesStatic();
}

// redraw function for zooming in on, and panning the svg, courtesy of http://jsfiddle.net/nrabinowitz/QMKm3/
function redraw() {
    // console.log("here", d3.event.translate, d3.event.scale);
    svg.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
    //console.log(d3.event.translate, d3.event.scale)
}

function getStatements(queryCUI, clickCount)
{
    $("#statement_loader").show();

    $.when(ajaxStatements(queryCUI, "incoming", clickCount), ajaxStatements(queryCUI, "outgoing", clickCount))
        .then(function(incomingJSON, outgoingJSON)
        {
            //console.log(incomingJSON, outgoingJSON);

            var results = incomingJSON[0]["results"]["bindings"].concat(outgoingJSON[0]["results"]["bindings"]);
            //console.log(results);

            getNodes(results)
        })
}

function ajaxStatements(queryCUI, mode, clickCount)
{
    var sparqlLimit = 15;

    var baseQuery =

        "PREFIX : <http://purl.org/net/fcnmed/> " +

        "SELECT DISTINCT ?statementID, ?subjectName, ?subjectCUI, ?subjectConceptID, ?subjectSemType, ?predicate, " +
        "?objectName, ?objectCUI, ?objectConceptID, ?objectSemType " +

        "WHERE { " +

        "?statement rdf:type rdf:Statement; " +
        ":hasStatementID ?statementID. " +

        "?statement rdf:subject ?subject. " +
        "?subject rdf:type skos:Concept; " +
        ":hasName ?subjectName; " +
        ":hasCUI ?subjectCUI; " +
        ":hasSemanticType ?subjectSemType. " +
        "OPTIONAL {?subject :hasConceptID ?subjectConceptID.} " +

        "?statement rdf:predicate ?predicate." +

        "?statement rdf:object ?object." +
        "?object rdf:type skos:Concept;" +
        ":hasName ?objectName; " +
        ":hasCUI ?objectCUI; " +
        ":hasSemanticType ?objectSemType. " +
        "OPTIONAL {?object :hasConceptID ?objectConceptID.} ";

    var queryLimit = "} LIMIT " + String(sparqlLimit) + " OFFSET " + String(clickCount * sparqlLimit);

    var queryModeInsert;

    if (mode == "incoming")
    {
        queryModeInsert =

            "{?object :hasCUI \"" + queryCUI + "\"^^<http://www.w3.org/2000/01/rdf-schema#Literal>} ";
    }
    else if (mode == "outgoing")
    {
        queryModeInsert =
            "{?subject :hasCUI \"" + queryCUI + "\"^^<http://www.w3.org/2000/01/rdf-schema#Literal>} ";
    }

    var sparqlQuery = baseQuery + queryModeInsert + queryLimit;

        //"PREFIX : <http://purl.org/net/fcnmed/> " +
        //
        //"SELECT ?statementID, ?subjectName, ?subjectCUI, ?subjectConceptID, ?subjectSemType, ?predicate, ?objectName, " +
        //"?objectCUI, ?objectConceptID, ?objectSemType " +
        //"WHERE " +
        //"{ " +
        //"{ " +
        //"SELECT DISTINCT * " +
        //"WHERE " +
        //"{ " +
        //"?statement rdf:type rdf:Statement. " +
        //"?statement :hasStatementID ?statementID. " +
        //"?statement rdf:subject ?subject. " +
        //"?statement rdf:object ?object. " +
        //"?statement rdf:predicate ?predicate. " +
        //
        //"?subject rdf:type skos:Concept. " +
        //"?subject :hasName ?subjectName. " +
        //"?subject :hasCUI ?subjectCUI. " +
        //"?subject :hasSemanticType ?subjectSemType. " +
        //"OPTIONAL {?subject :hasConceptID ?subjectConceptID.} " +
        //
        //"?object rdf:type skos:Concept. " +
        //"?object :hasName ?objectName. " +
        //"?object :hasSemanticType ?objectSemType. " +
        //"?object :hasCUI ?objectCUI. " +
        //"OPTIONAL {?object :hasConceptID ?objectConceptID.} " +
        //"FILTER regex (?objectCUI, \"" + queryCUI + "\"^^<http://www.w3.org/2000/01/rdf-schema#Literal>)" +
        //"} LIMIT " + String(sparqlLimit / 2) + " OFFSET " + String(clickCount * (sparqlLimit / 2)) +
        //"} " +
        //"UNION " +
        //"{ " +
        //"SELECT DISTINCT * " +
        //"WHERE " +
        //"{ " +
        //"?statement rdf:type rdf:Statement. " +
        //"?statement :hasStatementID ?statementID. " +
        //"?statement rdf:subject ?subject. " +
        //"?statement rdf:object ?object. " +
        //"?statement rdf:predicate ?predicate. " +
        //
        //"?subject rdf:type skos:Concept. " +
        //"?subject :hasName ?subjectName. " +
        //"?subject :hasCUI ?subjectCUI. " +
        //"?subject :hasSemanticType ?subjectSemType. " +
        //"OPTIONAL {?subject :hasConceptID ?subjectConceptID.} " +
        //
        //"?object rdf:type skos:Concept. " +
        //"?object :hasName ?objectName. " +
        //"?object :hasCUI ?objectCUI. " +
        //"?object :hasSemanticType ?objectSemType. " +
        //"OPTIONAL {?object :hasConceptID ?objectConceptID.} " +
        //"FILTER regex (?subjectCUI, \"" + queryCUI + "\"^^<http://www.w3.org/2000/01/rdf-schema#Literal>) " +
        //"} LIMIT " + String(sparqlLimit / 2) + " OFFSET " + String(clickCount * (sparqlLimit / 2)) +
        //"} " +
        //"} ";

    //console.log(sparqlQuery);

    var queryParameters =
    {
        "default-graph-uri": graphURL,
        "query": sparqlQuery,
        "debug": "on",
        "timeout": "",
        "format": "application/json",
        "save": "display",
        "fname": ""

    };

    var endpointBaseURL = "http://virtuosop.ddmgraph-uva.vm.surfsara.nl/cache/index.php?server=local&";
    //var endpointBaseURL = "http://virtuosop.ddmgraph-uva.vm.surfsare.nl/sparql?";
    var endpointQueryURL = "";

    for (var parameter in queryParameters)
    {
        endpointQueryURL = endpointQueryURL + parameter + "=" + encodeURIComponent(queryParameters[parameter]) + "&";
    }

    var endpointURL = endpointBaseURL + endpointQueryURL;
    //console.log(endpointURL);

    return $.ajax(
            {

                url: endpointURL,
                data:
                {
                    format: "json"
                }
                //success: function( response ) {
                //    console.log("Success");
                //    graph = response;
                //    console.log(graph);
                //    getNodes(graph);
                //    $("#statement_loader").hide();
                //},
                //
                //error: function(jqXHR, textStatus, errorThrown)
                //{
                //    console.log(textStatus, errorThrown);
                //    $("#statement_loader").hide();
                //}
            });
}

function getNodes(statements)
{
    //console.log("Ajax request completed");

    for (var i = 0; i < statements.length; i++)
    {
        var subjectNodeIndex = getIndex("CUI", statements[i]["subjectCUI"]["value"], nodes);
        var objectNodeIndex = getIndex("CUI", statements[i]["objectCUI"]["value"], nodes);

        if (subjectNodeIndex == -1)
        {
            addNode(i, statements, "subject")
        }
        else if (subjectNodeIndex >= 0)
        {
            var subjectSemType = statements[i]["subjectSemType"]["value"]
            var nodeSemType = nodes[subjectNodeIndex]["semType"]

            if (nodeSemType.indexOf(subjectSemType) == -1)
            {
                nodeSemType.push(subjectSemType)
            }
        }

        if (objectNodeIndex == -1)
        {
            addNode(i, statements, "object");
        }
        else if (objectNodeIndex >= 0)
        {
            var objectSemType = statements[i]["objectSemType"]["value"]
            var nodeSemType = nodes[objectNodeIndex]["semType"]

            if (nodeSemType.indexOf(objectSemType) == -1)
            {
                nodeSemType.push(objectSemType)
            }
        }
    }

    getLinks(statements)
}


//function getNodesStatic()
//{
//
//    d3.json("json/diabetes_statements_static.json", function (error, graphStatic)
//    {
//        if (error)
//            throw error;
//
//        console.log("Loading json completed");
//
//        var statements = graphStatic["results"]["bindings"];
//
//        for (var i = 0; i < statements.length; i++)
//        {
//
//            console.log(i);
//
//            var subjectNodeIndex = getIndex("CUI", statements[i]["subjectCUI"]["value"], nodes);
//            var objectNodeIndex = getIndex("CUI", statements[i]["objectCUI"]["value"], nodes);
//
//            if (subjectNodeIndex == -1)
//            {
//                addNode(i, statements, "subject")
//            }
//            else if (subjectNodeIndex >= 0)
//            {
//                var subjectSemType = statements[i]["subjectSemType"]["value"]
//                var nodeSemType = nodes[subjectNodeIndex]["semType"]
//
//                if (nodeSemType.indexOf(subjectSemType) == -1)
//                {
//                    nodeSemType.push(subjectSemType)
//                }
//            }
//
//            if (objectNodeIndex == -1)
//            {
//                addNode(i, statements, "object");
//            }
//            else if (objectNodeIndex >= 0)
//            {
//                var objectSemType = statements[i]["objectSemType"]["value"]
//                var nodeSemType = nodes[objectNodeIndex]["semType"]
//
//                if (nodeSemType.indexOf(objectSemType) == -1)
//                {
//                    nodeSemType.push(objectSemType)
//                }
//            }
//        }
//
//        getLinks(statements)
//
//    });
//}

function getLinks(graphJSON)
{
    for (var i = 0; i < graphJSON.length; i++)
    {
        var linkIndex = getIndex("statementID", graphJSON[i]["statementID"]["value"], links)

        // check if the link already exists in the array, if not add it to the array
        if (linkIndex == -1)
        {
            var statementID = graphJSON[i]["statementID"]["value"];
            var sourceConcept = graphJSON[i]["subjectCUI"]["value"];
            var targetConcept = graphJSON[i]["objectCUI"]["value"];
            var predicateURI = graphJSON[i]["predicate"]["value"];
            var predicate = predicateURI.substring(predicateURI.lastIndexOf("/") + 1).replace("_", " ").toLowerCase();

            //console.log("source concept " + sourceConcept + "; target concept " + targetConcept)

            var sourceIndex = getIndex("CUI", sourceConcept, nodes);
            var targetIndex = getIndex("CUI", targetConcept, nodes);

            var tempLink = new Object;
            tempLink.statementID = statementID;
            tempLink.source = sourceIndex;
            tempLink.target = targetIndex;
            tempLink.predicate = predicate;
            tempLink.clicked = false;

            /*
             Preparations for additional link attributes, indicating the number of citations and sentences from which
             a statement is derived respectively
             */
            //tempLink.nOfSentences = graphJSON[i]["nOfSentences"]["value"];
            //tempLink.nOfCitations = graphJSON[i]["nOfCitations"]["value"];

            links.push(tempLink);
        }
    }

    updateDegreeCounts(nodes, links);

    draw(nodes, links)
}

function draw(nodes, links)
{
    $("#statement_loader").hide();

    force.nodes(nodes)
         .links(links)
         .start();

    link = svg.selectAll(".link")
                  .data(links, function(d) {return d.statementID});

    link.exit().remove();

    link.enter()
        .insert("line", ".node")
        .attr("class", "link")
        .attr("x1", function(d) {return d.source.x;})
        .attr("y1", function (d) {return d.source.y;})
        .attr("x2", function(d) {return d.target.x;})
        .attr("y2", function (d) {return d.target.y;})
        .style("marker-end",  "url(#marker)")
        .on("mouseover", linkToolTip.show)
        .on("mouseout", linkToolTip.hide)
        .on("click", function(d)
        {
            // reset the "clicked" status of all nodes (to false) before assigning true to the clickedElement's
            // clicked attribute
            d3.selectAll(".node circle").each(function(d) {return d.clicked = false;});

            // reset the "clicked" status of all links (to false) before assigning true to the clickedElement's
            // clicked attribute
            d3.selectAll(".link").each(function(d) {return d.clicked = false;});

            d3.select(this).datum().clicked = true;

            // reset all border colors to ensure that the previously clicked element is blacked out
            setExpansionColors();

            //// color the clicked link as well as its source and target nodes
            //d3.select(this).style("stroke", "#dd4814");
            //
            //var sourceNode = d3.selectAll(".node > circle").filter(function(data) {return data == d.source});
            //colorNodeLabel(sourceNode, "full");
            //
            //var targetNode = d3.selectAll(".node > circle").filter(function(data) {return data == d.target});
            //colorNodeLabel(targetNode, "full");

            generateSideBarLinkDetails(d);

        });

    var timer = 0;
    var delay = 200;
    var singleClick = true;

    group = svg.selectAll(".node")
              .data(nodes, function(d) {return d.CUI});

    group.exit().remove();

    node = group.enter()
                .append("g")
                .attr("class", "node");

    node.append("circle")
        .attr("cx", function(d) {return d.x;})
        .attr("cy", function(d) {return d.y;})
        .attr("r", svgWidth / 150)
        .attr("fill", function(d) {return colorNode(d)})
        .on("mouseover", function(d)
                            {
                                if (d.clicked == false)
                                {
                                    colorNodeLabel(d3.select(this), "label");
                                }
                            })
        .on("mouseout", function(d)
                            {
                                if (d.clicked == false)
                                {
                                    d3.select(this.parentNode).select("foreignObject > .wrapped")
                                                              .style("color", null)
                                                              .style("opacity", null);
                                }
                            })
        .on("click", function(d)
        {

            var clickedElement = d3.select(this);

            // courtsey of https://css-tricks.com/snippets/javascript/bind-different-events-to-click-and-double-click/
            // set a timeout that triggers the click event after the delay in order to allow the user to
            // double click
            timer = setTimeout(function()
            {
                // in case the user clicked just one time, trigger the appropriate action
                if (singleClick)
                {
                    // reset the "clicked" status of all nodes (to false) before assigning true to the clickedElement's
                    // clicked attribute
                    d3.selectAll(".node circle").each(function(d) {return d.clicked = false;});

                    // reset the "clicked" status of all links (to false) before assigning true to the clickedElement's
                    // clicked attribute
                    d3.selectAll(".link").each(function(d) {return d.clicked = false;});

                    clickedElement.datum().clicked = true;

                    // reset all border colors to ensure that the border of the previously clicked node is blacked out
                    setExpansionColors();

                    // set the border color of the clicked element
                    //colorNodeLabel(clickedElement, "full");

                    generateSideBarConceptDetails(d);



                }

                // set singleClick to true in order to allow single clicks after a double click
                singleClick = true;
            }, delay);
        })
        .on("dblclick", function(d)
        {
            // clear the timeout in case the user double clicks
            clearTimeout(timer);

            // set singleClick to false
            singleClick = false;

            d.clickCount += 1;
            d.expanded = true;

            // set the border color of the node to indicate that it has been double clicked
            //d3.select(this).style("stroke", "#5C2040");

            getStatements(d.CUI, d.clickCount - 1);

        })
        .on("contextmenu", function(d)
        {
            // prevent the context menu to pop up
            d3.event.preventDefault();

            // do not allow the central node (for which the visualization is initialized) to be collapsed and make
            // sure that only expanded nodes can be collapsed
            if (d.referenceStatement != null && d.expanded == true)
            {

                // remove border color of the node to indicate that it hasn't been doubleclicked
                //d3.select(this).style("stroke", null);

                // get the list of nodes that need to be collapsed
                var collapseList = getCollapseList(d);

                // loop through the nodes that need to be collapsed and collapse each of them
                for (var node in collapseList)
                {
                    //console.log(collapseList[node])
                    collapseNode(collapseList[node]);
                }

            }
        });
        //.on("mouseover", function(d)
        //{
        //    d3.selectAll(".node").filter(function() {})
        //});

    node.append("text")
        .attr("class", "nodelabel")
        .style("line-height", "10px")
        .text(function(d) {return d.conceptName});

    // wrap the labels across multiple lines
    wrapText();

    setExpansionColors();

    force.on("tick", function()
    {
        d3.selectAll(".node > circle").attr("cx", function(d) {return d.x;})
                                      .attr("cy", function(d) {return d.y;});

        d3.selectAll("foreignObject").attr("x", function(d) {return d.x + 10 })
                                     .attr("y", function(d) {return d.y - (d3.select("foreignObject").attr("height") / 2)});

        link.attr("x1", function(d) {return d.source.x;})
            .attr("y1", function(d) {return d.source.y;})
            .attr("x2", function(d) {return d.target.x;})
            .attr("y2", function(d) {return d.target.y;});
    });

}

// function that spreads text labels across multiple lines, as such avoiding very long labels, implemented using
// d3textwrap.js
function wrapText()
{

    // first we select all labels (text elements) that we've added when drawing the nodes
    d3.selectAll("text").each(function()
    {
        // set the desired width and height of the box where we want to fit the label into
        var foWidth = 110;
        var foHeight = 75;

        // set a bounding rectangle in which the label should be fitted
        var bounds = {
            x: parseFloat(d3.select(this.parentNode).select("circle").attr("cx")),
            y: parseFloat(d3.select(this.parentNode).select("circle").attr("cy")),
            width: foWidth,
            height: foHeight
        };

        //console.log(bounds);

        // wrap the current text element into the bounding box
        d3.select(this).textwrap(bounds);
    });
}

function generateMarker()
{
    var defs = d3.select("svg.graph").append("defs");

    defs.append("marker")
        .attr("id", "marker")
        .attr({
            "viewBox": "0 0 12 12",
            "refX": 50,
            "refY": 6,
            "markerWidth": 6,
            "markerHeight": 6,
            "orient": "auto",
            "markerUnit": "strokeWidth"
        })
        .append("path")
        .attr("d", "M 0 0 L 12 6 L 0 12 L 6 6 Z")
        .style("stroke", "#777")
        .style("fill", "#777");
}

function setNodeToolTip()
{
    //console.log("setting up tooltip")
    nodeToolTip = d3.tip()
                    .attr("class", "d3-tip")
                    .html(function(d) {return "<span>" + titleCaseConversion(d.conceptName) + "</span>"})
                    .offset([-10, 0]);

    svg.call(nodeToolTip);
}

function setLinkToolTip()
{
    linkToolTip = d3.tip()
                    .attr("class", "d3-tip")
                    .html(function(d) {return "<span>" /*+ d.source.conceptName + " <strong>"*/ + d.predicate + /*"</strong> "
                                                + d.target.conceptName + */ "</span>"})
                    .offset(function()
                    {
                        var mousePosition = d3.mouse(this);
                        var xBBox = this.getBBox().x;
                        var yBBox = this.getBBox().y;
                        var BBoxWidth = this.getBBox().width;
                        var BBoxHeight = this.getBBox().height;

                        var alpha = getToolTipAlpha(this);

                        var topOffset = mousePosition[1] -  (yBBox + (0.5 * BBoxHeight));

                         if (alpha < 0)
                         {
                             var leftOffset = mousePosition[0] - xBBox - 10;
                         }
                         else
                         {
                             var leftOffset = mousePosition[0] - xBBox - BBoxWidth + 10;
                         }

                         return [topOffset, leftOffset]
                    })

                    .direction(function()
                    {
                        var alpha = getToolTipAlpha(this);

                        if (alpha < 0)
                        {
                            return "w";
                        }
                        else if (alpha == 0)
                        {
                            return "n";
                        }
                        else
                        {
                            return "e";
                        }
                    });

    svg.call(linkToolTip);
}

function addNode(nodePosition, graphJSON, subjectOrObject)
{
    //console.log("node with this CUI does not yet exist");
    //console.log(subjectOrObject);

    var invSubjectOrObject;
    if (subjectOrObject == "subject")
    {
        invSubjectOrObject = "object";
    }
    else if (subjectOrObject = "object")
    {
        invSubjectOrObject = "subject";
    }

    var tempNode = new Object;
    tempNode.CUI = graphJSON[nodePosition][subjectOrObject + "CUI"]["value"];
    tempNode.conceptName = graphJSON[nodePosition][subjectOrObject + "Name"]["value"];
    tempNode.semType = [graphJSON[nodePosition][subjectOrObject + "SemType"]["value"]];
    tempNode.degree = null;
    tempNode.clicked = false;

    if (graphJSON[nodePosition][subjectOrObject + "ConceptID"])
    {
        tempNode.conceptID = graphJSON[nodePosition][subjectOrObject + "ConceptID"]["value"];
    }
    if (graphJSON[nodePosition][subjectOrObject + "CUI"]["value"] == initializeCUI)
    {
        tempNode.clickCount = 1;
        tempNode.expanded = true;

        // the node for which we initialize the graph has no statement in which it was first referred
        tempNode.referenceNode = null;
        tempNode.referenceStatement = null;
    } else
    {
        tempNode.clickCount = 0;
        tempNode.expanded = false;

        // for the other statements, the statement in which it was first referred is the statement with the ID in which
        // we first encountered it
        tempNode.referenceNode = graphJSON[nodePosition][invSubjectOrObject + "CUI"]["value"];
        tempNode.referenceStatement = graphJSON[nodePosition]["statementID"]["value"];
    }
    /*
    Preparations for additional node attributes, indicating the number of incoming and outgoing links to respectively
     from the node
     */
    //tempNode.indegree = graphJSON[nodePosition][subjectOrObject + "Indegree"]["value"];
    //tempNode.outdegree = graphJSON[nodePosition][subjectOrObject + "Outdegree"]["value"];
    //console.log(tempNode);

    nodes.push(tempNode);
}

function getIndex(identifyingProperty, identifier, array)
{

    //console.log(identifyingProperty, identifier, array)

    for (var i = 0; i < array.length; i++)
    {
        if (array[i][identifyingProperty] == identifier)
        {
            return i;
        }
    }

    // return -1 in case the node does not yet exist
    return -1;
}

function titleCaseConversion(string)
{
    return string.replace(/\w*\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function setExpansionColors()
{
    // set appropriate border color for expanded nodes to allow tracking of the path
    d3.selectAll(".node > circle").style("stroke", function(d)
    {
        if (d.expanded)
        {
            return "#38b44a"
        }
    });

    // set appropriate color of links, where links of which the source and target are expanded are colored to highlight
    // the path that was clicked
    d3.selectAll(".link").style("stroke", function(d)
    {
        if (d.source.expanded && d.target.expanded &&
            (d.source.referenceStatement == d.statementID ||
            d.target.referenceStatement == d.statementID))
        {
            return "#38b44a";
        }
    });

    // reset the color and opacity of the node labels
    d3.selectAll("foreignObject .wrapped").style("color", null)
                                          .style("opacity", null);

    // in case a node was selected prior to double clicking the current node, we should keep this node colored
    var clickedNode = d3.selectAll(".node > circle").filter(function(d) {return d.clicked == true});
    if (clickedNode.size() == 1)
    {
        colorNodeLabel(clickedNode, "full");
    }

    // in case a link was selected prior to double clicking the current node, we should keep this link colored
    var clickedLink = d3.selectAll(".link").filter(function(d) {return d.clicked == true});
    if (clickedLink.size() == 1)
    {
        // color the clicked link as well as its source and target nodes
        clickedLink.style("stroke", "#dd4814");

        var sourceNode = d3.selectAll(".node > circle").filter(function(data) {return data == clickedLink.datum().source});
        colorNodeLabel(sourceNode, "full");

        var targetNode = d3.selectAll(".node > circle").filter(function(data) {return data == clickedLink.datum().target});
        colorNodeLabel(targetNode, "full");
    }

}

// color a node according to its FIRST semantic type
function colorNode(node)
{
    // we will assume that the first semantic type of a node that was encountered is its most used one, therefore we
    // first get the semantic type of the node
    var nodeSemType = node.semType[0];

    // get the index of the semantic type in semTypeJSON
    var semTypeIndex = getIndex("abbreviation", nodeSemType, semTypeJSON);

    // get the index of the category to which the semantic type belongs
    var categoryIndex = getIndex("categoryName", semTypeJSON[semTypeIndex]["category"], categoryList);

    // using the category index, get the color corresponding to the category
    var nodeColor = categoryList[categoryIndex]["hexColor"];

    // return the node color
    return nodeColor

}

function colorNodeLabel(node, mode)
{

    if (mode == "full" || mode == "node")
    {
        node.style("stroke", "#dd4814");
    }

    if (mode == "full" || mode == "label")
    {

        node.select(function () {
            return this.parentNode
        })
            .select(".wrapped")
            .style("color", "#dd4814")
            .style("opacity", 1);
    }
}

function getToolTipAlpha(link)
{

    var originX = parseFloat(d3.select(link).attr("x1"));
    var originY = parseFloat(d3.select(link).attr("y1"));

    var destinationX = parseFloat(d3.select(link).attr("x2"));
    var destinationY = parseFloat(d3.select(link).attr("y2"));

    var spanX = destinationX - originX;
    var spanY = destinationY - originY;

    var alpha = Math.atan(spanY / spanX);
    return alpha;
}

function generateSideBarLinkDetails(clickedElement)
{

    // hide the detail items and show the loader
    $("#conceptdetails").hide();
    $("#linkdetails").hide();
    $("#accordion").hide();
    $("#sidebar_loader").show();

    d3.select("#linkOverviewButton").remove();

    var sideBarDetails = clickedElement;

    $.when(ajaxLinkKeyIndicators(clickedElement.statementID, "citations"),
            ajaxLinkKeyIndicators(clickedElement.statementID, "sentences"))
        .then(function(responseLCC, responseLSC)
                {
                    sideBarDetails = handleSingleRowJSON(responseLCC[0], sideBarDetails);
                    sideBarDetails = handleSingleRowJSON(responseLSC[0], sideBarDetails);

                    //console.log(sideBarDetails);

                    populateSideBarLink(sideBarDetails);

                    //console.log("Click registered;")
                    //console.log(sideBarDetails);
                    generateLinkModal(clickedElement, sideBarDetails);

                })
}

function populateSideBarLink(sideBarDetails)
{
    // before injecting the new html we should actually empty the contents of the .detailstext elements and delete
    // the source- and targetHeaders as those are injected on the fly.
    d3.selectAll("#linkdetails > p.detailstext").html("");
    d3.selectAll("#linkdetails > em > span").html("");
    d3.selectAll("#sourceHeader").remove();
    d3.selectAll("#targetHeader").remove();

    for (var property in sideBarDetails)
    {
        var sideBarElement = d3.select("#" + property);

        switch (property)
        {
            case "citationsCount":
                sideBarElement.html("<strong><abbr title=\"The number of unique articles in which a statement " +
                                    "occurs\">Citations count:</abbrv></strong> " + String(sideBarDetails[property]));
                break;

            case "predicate":
                sideBarElement.html(sideBarDetails[property]);
                break;

            case "sentencesCount":
                sideBarElement.html("<strong><abbr title=\"The number of unique sentences from which a statement is " +
                                    "derived\">Sentences count:</abbr></strong> " + String(sideBarDetails[property]));
                break;

            case "source":
                handleLinkObject(sideBarDetails, property);
                break;

            case "statementID":
                sideBarElement.html("Statement #" + sideBarDetails[property]);
                break;

            case "target":
                handleLinkObject(sideBarDetails, property);
                break;
        }
    }

    sideBarElement = d3.select("div#linkdetails");
    //console.log(sideBarElement)
    sideBarElement.insert("button", "h4#statementID")
                  .attr("type", "button")
                  .attr("class", "btn btn-primary btn-xs")
                  .attr("id", "linkOverviewButton")
                  .attr("data-toggle", "modal")
                  .attr("data-target", "#linkdetailsmodal")
                  .html("Show Details");

    $("#sidebar_loader").hide();
    $("#linkdetails").show();
    $("#accordion").show();

    collapseLegend();

    //var sideBarDetails = new Object;
    //sideBarDetails.statementID = clickedElement.statementID;
    //sideBarDetails.predicate = clickedElement.predicate;
    //
    //var sourceCharacteristics =
    //{
    //    CUI: clickedElement.source.CUI,
    //    conceptName: clickedElement.source.conceptName
    //};
    //
    //if (clickedElement.source.conceptID)
    //{
    //    sourceCharacteristics.conceptID = clickedElement.source.conceptID;
    //};
    //
    //sideBarDetails.source = sourceCharacteristics;
    //
    //var targetCharacteristics =
    //{
    //    CUI: clickedElement.target.CUI,
    //    conceptName: clickedElement.target.conceptName
    //};
    //
    //if (clickedElement.target.conceptID)
    //{
    //    targetCharacteristics.conceptID = clickedElement.target.conceptID;
    //}
    //
    //sideBarDetails.target = targetCharacteristics;
    //
    //console.log(sideBarDetails)
}

function handleLinkObject(sideBarDetails, property, mode)
{
    mode = typeof mode !== 'undefined' ?  mode : "";

    for(var key in sideBarDetails[property])
    {
        var sideBarElement = d3.select("#" + mode + property + key);

        switch (key)
        {
            case "conceptID":
                sideBarElement.html("<strong>Concept ID:</strong> " + sideBarDetails[property][key]);
                break;

            case "CUI":
                sideBarElement.html("<strong>CUI:</strong> " + sideBarDetails[property][key]);
                break;

            case "conceptName":

                var linkDetails = d3.select("#" + mode + property + key).select(function() {return this.parentNode});

                var htmlHeaderInsert;

                if (mode == "modal")
                {
                    htmlHeaderInsert = property.charAt(0).toUpperCase() + property.slice(1) + " Concept";
                }
                else
                {
                    htmlHeaderInsert = property.charAt(0).toUpperCase() + property.slice(1) + "<span></span>";
                }

                //console.log(htmlHeaderInsert)

                linkDetails.insert("h4", "#" + mode + property + key)
                           .attr("class", mode + "header")
                           .attr("id", mode + property + "Header")
                           .html(htmlHeaderInsert);

                sideBarElement.html("<strong>Name:</strong> " + sideBarDetails[property][key]);

                if (mode == "modal")
                {
                    sideBarElement = d3.select("#modalstatement ." + property + key);
                }
                else
                {
                    sideBarElement = d3.select("#statement ." + property + key);
                }

                sideBarElement.html(sideBarDetails[property][key]);
                break;
        }
    }

    // define the HTML for a button that can be used to load concept details
    var buttonHTMLInsert = "<button type=\"button\" class=\"btn btn-primary btn-xs\" id=\"" + property + "Button\">" +
                            "Load Concept</button>";

    // inject the html in the span within the h4 header
    sideBarElement = d3.select("h4#" + property + "Header > span");
    sideBarElement.html(buttonHTMLInsert);

    // add an eventListner to the button that we've just created such that we can load the relevant concept data on click
    d3.select("#linkdetails button#" + property + "Button").on("click", function()
    {
        // select the div (#source or #target) in which the button is contained
        var button = d3.select(this);
        var span = d3.select(button.node().parentNode);
        var h4 = d3.select(span.node().parentNode);
        var divSource  = d3.select(h4.node().parentNode);

        // extract the CUI of the concept of which the button was clicked
        var clickedCUI = divSource.select("#" + property + "CUI").text().slice(5);

        // select the node corresponding to that CUI, and of which the details should be loaded
        var nodeToLoad = d3.selectAll(".node > circle").filter(function(d){return d.CUI == clickedCUI});

        // reset all border colors to ensure that the border of the previously clicked node is blacked out
        setExpansionColors();

        // color the node and label of the clicked node
        colorNodeLabel(nodeToLoad, "full")

        // load the details of the node
        generateSideBarConceptDetails(nodeToLoad.datum());

    });
}

function generateSideBarConceptDetails(clickedElement)
{
    // hide the detail items and show the loader
    $("#conceptdetails").hide();
    $("#linkdetails").hide();
    $("#accordion").hide();
    $("#sidebar_loader").show();

    d3.select("#conceptOverviewButton").remove();

    var sideBarDetails = new Object;
    sideBarDetails.conceptName = clickedElement.conceptName;
    sideBarDetails.CUI = clickedElement.CUI;
    sideBarDetails.semType = clickedElement.semType;
    if (clickedElement.conceptID)
    {
        sideBarDetails.conceptID = clickedElement.conceptID;
    }

    //console.log("enter generateSideBarDetails")
    $.when(ajaxMissingConceptDetails(clickedElement.CUI))
        .then(function(response)
                {
                    //console.log(response);
                    sideBarDetails = handleConceptDetailJSON(response, sideBarDetails);

                    if (sideBarDetails["sameAs"]) {

                        var ajaxCalls = [];

                        for (var key in sideBarDetails["sameAs"]) {
                            if (key == "lld") {
                                var lldCall = ajaxLinkedLifeData(sideBarDetails["sameAs"][key]);
                                ajaxCalls.push(lldCall);
                            }

                            if (key == "bio2rdf") {
                                var bio2rdfCall = ajaxBio2RDF(sideBarDetails["sameAs"][key]);
                                ajaxCalls.push(bio2rdfCall);
                            }
                        }

                        //console.log(ajaxCalls)

                        $.when.apply($, ajaxCalls).then(function () {
                                                        //console.log(arguments);

                                                        if (ajaxCalls.length == 1) {

                                                            var JSON = arguments[0];

                                                            if (JSON["head"]["vars"].length == 2) {
                                                                sideBarDetails = handleSingleRowJSON(JSON, sideBarDetails);
                                                            }
                                                            else if (JSON["head"]["vars"].length == 14) {
                                                                sideBarDetails = handleBio2RDFJSON(JSON, sideBarDetails);
                                                            }

                                                        }
                                                        else if (ajaxCalls.length >= 1) {
                                                            $.each(arguments, function (index, responseData) {

                                                                var JSON = responseData[0];

                                                                if (JSON["head"]["vars"].length == 2) {
                                                                    sideBarDetails = handleSingleRowJSON(JSON, sideBarDetails);
                                                                }
                                                                else if (JSON["head"]["vars"].length == 14) {
                                                                    sideBarDetails = handleBio2RDFJSON(JSON, sideBarDetails);
                                                                }
                                                            });
                                                        }

                                                        //console.log(sideBarDetails);

                                                        populateSideBarConcept(sideBarDetails, clickedElement);

                                                        if (sideBarDetails.clinicalFeatures || sideBarDetails.description ||
                                                            sideBarDetails.diagnosis || sideBarDetails.inheritance ||
                                                            sideBarDetails.molecularGenetics || sideBarDetails.pathogenesis ||
                                                            sideBarDetails.populationGenetics)
                                                        {
                                                            //console.log("about to populate concept modal")

                                                            // define the HTML for a button that can be used to load concept details
                                                            //var buttonHTMLInsert = "<button type=\"button\" " +
                                                            //                       "class=\"btn btn-primary btn-xs\" " +
                                                            //                       "id=\"conceptOverviewButton\">" +
                                                            //                       "Load Details</button>";

                                                            // inject the html in the span within the h4 header
                                                            var sideBarElement = d3.select("div#conceptDetailsHeader");
                                                            //console.log(sideBarElement)
                                                            sideBarElement.insert("button", "h4")
                                                                          .attr("type", "button")
                                                                          .attr("class", "btn btn-primary btn-xs")
                                                                          .attr("id", "conceptOverviewButton")
                                                                          .attr("data-toggle", "modal")
                                                                          .attr("data-target", "#conceptdetailsmodal")
                                                                          .html("Show Details");

                                                            populateConceptModal(sideBarDetails, clickedElement);

                                                            // TODO: fix reopen to tops
                                                            // attempts to reopen model on top, does not work though
                                                            //$("#conceptdetailsmodal").on("show.bs.modal",
                                                            //    function()
                                                            //    {
                                                            //        console.log("modal shown");
                                                            //        $(".modal-body").scrollTop(0);
                                                            //        //if ($(".modal-body").scrollTop() != 0)
                                                            //        //{
                                                            //        //    console.log("Scrolled")
                                                            //        //    $(".modal-body").scrollTop(0);
                                                            //        //    console.log("Reset scroll")
                                                            //        //}
                                                            //    });
                                                        }

                                                    });
                    }
                    else
                    {
                        populateSideBarConcept(sideBarDetails, clickedElement);
                    }

                });

    //console.log("single click registered")
}

function ajaxMissingConceptDetails(conceptCUI)
{

    //console.log("enter getMissingConceptDetails")

    var sparqlQuery = "PREFIX : <http://purl.org/net/fcnmed/> " +

        "SELECT DISTINCT ?GHRID, ?OMIMID, ?sameAs " +
        "WHERE {" +

            "?concept rdf:type skos:Concept; " +
                     ":hasCUI \"" + conceptCUI + "\"^^<http://www.w3.org/2000/01/rdf-schema#Literal>." +

            "OPTIONAL " +
            "{" +
                "?concept :hasGHRID ?GHRID. " +
            "}" +
            "OPTIONAL " +
            "{" +
            "?concept :hasOMIMID ?OMIMID. " +
            "}" +
            "OPTIONAL " +
            "{" +
            "?concept owl:sameAs ?sameAs. " +
            "}" +
        "}";

    //console.log(sparqlQuery);

    var queryParameters =
    {
        "default-graph-uri": graphURL,
        "query": sparqlQuery,
        "debug": "on",
        "timeout": "",
        "format": "application/json",
        "save": "display",
        "fname": ""

    };

    var endpointBaseURL = "http://virtuosop.ddmgraph-uva.vm.surfsara.nl/cache/index.php?server=local&";
    var endpointQueryURL = "";

    for (var parameter in queryParameters)
    {
        endpointQueryURL = endpointQueryURL + parameter + "=" + encodeURIComponent(queryParameters[parameter]) + "&";
    }

    var endpointURL = endpointBaseURL + endpointQueryURL;
    //console.log(endpointURL)

    //console.log("returning $.ajax")

    return $.ajax(
        {

            url: endpointURL,
            data:
            {
                format: "json"
            }//,
            //success: function( response ) {
            //    console.log("Success");
            //    graph = response;
            //    console.log(graph);
            //    getNodes(graph);
            //},
            //
            //error: function(jqXHR, textStatus, errorThrown)
            //{
            //    console.log(textStatus, errorThrown);
            //}
        });
}

function ajaxLinkedLifeData(conceptURI)
{

    //console.log("enter ajaxLinkedLifeData")

    var sparqlQuery =

        "SELECT ?definition, ?prefLabel " +
        "WHERE " +
        "{" +
            "SERVICE <http://linkedlifedata.com/sparql> " +
            "{" +

                "OPTIONAL " +
                "{" +
                    "<" + conceptURI + "> skos:definition ?definition. " +
                "} " +

                "OPTIONAL " +
                "{" +
                    "<" + conceptURI + "> skos:prefLabel ?prefLabel. " +
                "} " +
            "} " +
        "}";

    //console.log(sparqlQuery);

    var queryParameters =
    {
        "default-graph-uri": "",
        "query": sparqlQuery,
        "debug": "on",
        "timeout": "",
        "format": "application/json",
        "save": "display",
        "fname": ""

    };

    var endpointBaseURL = "http://virtuosop.ddmgraph-uva.vm.surfsara.nl/cache/index.php?server=local&";
    var endpointQueryURL = "";

    for (var parameter in queryParameters)
    {
        endpointQueryURL = endpointQueryURL + parameter + "=" + encodeURIComponent(queryParameters[parameter]) + "&";
    }

    var endpointURL = endpointBaseURL + endpointQueryURL;
    //console.log(endpointURL)

    //console.log("returning $.ajax")

    return $.ajax(
        {

            url: endpointURL,
            data:
            {
                format: "json"
            }//,
            //success: function( response ) {
            //    console.log("Success");
            //    graph = response;
            //    console.log(graph);
            //    getNodes(graph);
            //},
            //
            //error: function(jqXHR, textStatus, errorThrown)
            //{
            //    console.log(textStatus, errorThrown);
            //}
        });
}

function ajaxBio2RDF(conceptOmimURI)
{

    //console.log("enter ajaxBio2RDF")

    var sparqlQuery =

        "PREFIX dcterms: <http://purl.org/dc/terms/>" +

        "SELECT ?clinicalFeatures, ?description, ?diagnosis, ?inheritance, ?molecularGenetics, ?pathogenesis, " +
               "?populationGenetics, ?doID, ?icd9ID, ?icd10ID, ?orphanetID, ?snomedID, ?uniprotID, ?seeAlso " +

        "WHERE " +
        "{ " +
            "SERVICE <http://omim.bio2rdf.org/sparql> " +
            "{ " +
                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> dcterms:description ?description. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:diagnosis> ?diagnosis. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:inheritance> ?inheritance. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:pathogenesis> ?pathogenesis. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> rdfs:seeAlso ?seeAlso. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:clinical-features> ?clinicalFeatures. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:molecular-genetics> ?molecularGenetics. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:population-genetics> ?populationGenetics. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:x-uniprot> ?uniprot. " +
                    "?uniprot <http://bio2rdf.org/bio2rdf_vocabulary:identifier> ?uniprotID. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:x-orphanet> ?orphanet. " +
                    "?orphanet <http://bio2rdf.org/bio2rdf_vocabulary:identifier> ?orphanetID. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:x-icd10> ?icd10. " +
                    "?icd10 <http://bio2rdf.org/bio2rdf_vocabulary:identifier> ?icd10ID. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:x-icd9> ?icd9. " +
                "?icd9 <http://bio2rdf.org/bio2rdf_vocabulary:identifier> ?icd9ID. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:x-snomed> ?snomed. " +
                    "?snomed <http://bio2rdf.org/bio2rdf_vocabulary:identifier> ?snomedID. " +
                "} " +

                "OPTIONAL " +
                "{ " +
                    "<" + conceptOmimURI + "> <http://bio2rdf.org/omim_vocabulary:x-do> ?do. " +
                    "?do <http://bio2rdf.org/bio2rdf_vocabulary:identifier> ?doID. " +
                "} " +

            "}" +

        "}";

    //console.log(sparqlQuery);

    var queryParameters =
    {
        "default-graph-uri": "",
        "query": sparqlQuery,
        "debug": "on",
        "timeout": "",
        "format": "application/json",
        "save": "display",
        "fname": ""

    };

    var endpointBaseURL = "http://virtuosop.ddmgraph-uva.vm.surfsara.nl/cache/index.php?server=local&";
    var endpointQueryURL = "";

    for (var parameter in queryParameters)
    {
        endpointQueryURL = endpointQueryURL + parameter + "=" + encodeURIComponent(queryParameters[parameter]) + "&";
    }

    var endpointURL = endpointBaseURL + endpointQueryURL;
    //console.log(endpointURL)

    //console.log("returning $.ajax")

    return $.ajax(
        {

            url: endpointURL,
            data:
            {
                format: "json"
            }//,
            //success: function( response ) {
            //    console.log("Success");
            //    graph = response;
            //    console.log(graph);
            //    getNodes(graph);
            //},
            //
            //error: function(jqXHR, textStatus, errorThrown)
            //{
            //    console.log(textStatus, errorThrown);
            //}
        });
}

function ajaxLinkKeyIndicators(statementID, mode)
{
    //console.log("enter ajaxLinkKeyIndicators")

    var selectClause;
    var whereClause;

    if (mode == "citations")
    {
        selectClause = "SELECT (COUNT(DISTINCT ?article) AS ?citationsCount)";
        whereClause = "?statement dc:source ?article. ?article rdf:type bibo:AcademicArticle. ";
    }
    else if (mode == "sentences")
    {
        selectClause = "SELECT (COUNT(DISTINCT ?sentence) AS ?sentencesCount)";
        whereClause = "?statement :derivedFrom ?sentence. ?sentence rdf:type :Sentence. ";
    }

    var sparqlQuery =

        "PREFIX : <http://purl.org/net/fcnmed/> " +
        "PREFIX bibo: <http://purl.org/ontology/bibo/> " +
        "PREFIX dc: <http://purl.org/dc/terms/> " +

        selectClause +

        "WHERE " +
        "{ " +

            "?statement rdf:type rdf:Statement. " +
            whereClause +
            "?statement :hasStatementID " + statementID + ". " +
        "}";

    //console.log(sparqlQuery);

    var queryParameters =
    {
        "default-graph-uri": graphURL,
        "query": sparqlQuery,
        "debug": "on",
        "timeout": "",
        "format": "application/json",
        "save": "display",
        "fname": ""
    };

    var endpointBaseURL = "http://virtuosop.ddmgraph-uva.vm.surfsara.nl/cache/index.php?server=local&";
    var endpointQueryURL = "";

    for (var parameter in queryParameters)
    {
        endpointQueryURL = endpointQueryURL + parameter + "=" + encodeURIComponent(queryParameters[parameter]) + "&";
    }

    var endpointURL = endpointBaseURL + endpointQueryURL;
    //console.log(endpointURL)

    //console.log("returning $.ajax")

    return $.ajax(
        {

            url: endpointURL,
            data:
            {
                format: "json"
            }//,
            //success: function( response ) {
            //    console.log("Success");
            //    graph = response;
            //    console.log(graph);
            //    getNodes(graph);
            //},
            //
            //error: function(jqXHR, textStatus, errorThrown)
            //{
            //    console.log(textStatus, errorThrown);
            //}
        });
}

function handleConceptDetailJSON(conceptDetailJSON, sideBarDetails)
{
    //console.log(conceptDetailJSON);

    var results = conceptDetailJSON["results"]["bindings"];
    var singleRowProperties = ["GHRID", "OMIMID"];

    for (row in results)
    {
        for (property in results[row])
        {
            if (row == 0 && singleRowProperties.indexOf(property) != -1)
            {
                sideBarDetails[property] = results[row][property]["value"];
            }
            else if (row == 0 && singleRowProperties.indexOf(property) == -1)
            {
                sideBarDetails[property] = new Object;
                addSameAsLink(sideBarDetails[property], results, row);
            }
            else if (row > 0 && singleRowProperties.indexOf(property) == -1)
            {
                addSameAsLink(sideBarDetails[property], results, row);
            }
        }
    }

    //for (element in conceptDetailJSON)
    //{
    //    if (element == 0)
    //    {
    //        if (conceptDetailJSON[element]["GHRID"])
    //        {
    //            sideBarDetails.GHRID = conceptDetailJSON[element]["GHRID"]["value"];
    //        }
    //
    //        if (conceptDetailJSON[element]["OMIMID"])
    //        {
    //            sideBarDetails.OMIMID = conceptDetailJSON[element]["OMIMID"]["value"];
    //        }
    //
    //        if (conceptDetailJSON[element]["sameAs"])
    //        {
    //            sideBarDetails.sameAs = new Object;
    //
    //            addSameAsLink(sideBarDetails.sameAs, conceptDetailJSON, element);
    //        }
    //    }
    //    else
    //    {
    //        if (conceptDetailJSON[element]["sameAs"])
    //        {
    //            addSameAsLink(sideBarDetails.sameAs, conceptDetailJSON, element);
    //        }
    //    }
    //}

    //console.log(sideBarDetails);

    return sideBarDetails

}

// used for handling the linkedLifeDataJSON and linkKeyIndicatorsJSON
function handleSingleRowJSON(singleRowJSON, sideBarDetails)
{
    var results = singleRowJSON["results"]["bindings"];

    for (var property in results[0])
    {
        sideBarDetails[property] = results[0][property]["value"];
    }

    return sideBarDetails
}

function handleBio2RDFJSON(bio2RDFJSON, sideBarDetails)
{
    var results = bio2RDFJSON["results"]["bindings"];
    var stringProperties = bio2RDFJSON["head"]["vars"].slice(0, 7);
    var arrayProperties = bio2RDFJSON["head"]["vars"].slice(7);

    for (var row in results)
    {
        for (var property in results[row]) {

            //console.log(property);

            if (row == 0 && stringProperties.indexOf(property) != -1) {

                sideBarDetails[property] = results[row][property]["value"];

                //if (bio2RDFJSON[element]["clinicalFeatures"])
                //{
                //    sideBarDetails.clinicalFeatures = bio2RDFJSON[element]["clinicalFeatures"]["value"];
                //}
                //
                //if (bio2RDFJSON[element]["description"])
                //{
                //    sideBarDetails.description = bio2RDFJSON[element]["description"]["value"];
                //}
                //
                //if (bio2RDFJSON[element]["diagnosis"])
                //{
                //    sideBarDetails.diagnosis = bio2RDFJSON[element]["diagnosis"]["value"];
                //}
                //
                //if (bio2RDFJSON[element]["inheritance"])
                //{
                //    sideBarDetails.inheritance = bio2RDFJSON[element]["inheritance"]["value"];
                //}
                //
                //if (bio2RDFJSON[element]["molecularGenetics"])
                //{
                //    sideBarDetails.molecularGenetics = bio2RDFJSON[element]["molecularGenetics"]["value"];
                //}
                //
                //if (bio2RDFJSON[element]["pathogenesis"])
                //{
                //    sideBarDetails.pathogenesis = bio2RDFJSON[element]["pathogenesis"]["value"];
                //}
            }
            else if (row == 0 && arrayProperties.indexOf(property) != -1)
            {
                sideBarDetails[property] = [results[row][property]["value"]];
            }
            else if (row > 0 && arrayProperties.indexOf(property) != -1)
            {
                var ID = results[row][property]["value"];
                var IDs = sideBarDetails[property];

                if (IDs.indexOf(ID) == -1)
                {
                    IDs.push(ID)
                }
            }
        }
    }

    // sort the ID properties in ascending order
    for (var property in sideBarDetails)
    {
        if (arrayProperties.indexOf(property) != -1)
        {
            sideBarDetails[property].sort();
        }
    }

    //console.log(sideBarDetails);
    return sideBarDetails;
}

function addSameAsLink(sameAsObject, conceptDetailJSON, element)
{
    if (conceptDetailJSON[element]["sameAs"]["value"].indexOf("linkedlifedata") != -1)
    {
        sameAsObject.lld = conceptDetailJSON[element]["sameAs"]["value"];
    }
    else if (conceptDetailJSON[element]["sameAs"]["value"].indexOf("bio2rdf") != -1)
    {
        sameAsObject.bio2rdf = conceptDetailJSON[element]["sameAs"]["value"];
    }

}

function populateSideBarConcept(sideBarDetails, clickedElement)
{

    // before injecting the new html we should actually empty the contents of the .detailstext elements and delete
    // the identifiersHeader as that is injected on the fly. Furthermore we set the height of the definition box to 0
    // to prevent a lot of spacing in case no definition is available
    d3.selectAll("#conceptdetails > .detailstext").html("");
    d3.selectAll("h4#identifiersHeader").remove();
    d3.select("#definition").style("height", 0);

    var sideBarProperties = ["conceptName", "CUI", "conceptID", "definition", "prefLabel", "semType", "doID", "GHRID",
                             "icd9ID", "icd10ID", "OMIMID", "orphanetID", "snomedID", "uniprotID"];

    //console.log("populating sidebar")

    for (var key in sideBarProperties)
    {
        //console.log(key)
        if (sideBarProperties[key] in sideBarDetails)
        {
            d3.select("#" + sideBarProperties[key]).style("margin-bottom", "2px");
        }
        else
        {
            d3.select("#" + sideBarProperties[key]).style("margin-bottom", 0);
        }
    }

    for (var property in sideBarDetails)
    {
        if (sideBarProperties.indexOf(property) != -1)
        {
            var sideBarElement = d3.select("#" + property);

            var url;
            var baseHTML;
            var htmlInsert;

            switch (property)
            {
                case "conceptID":
                    sideBarElement.html("<strong>Concept ID:</strong> " + sideBarDetails[property]);
                    break;

                case "CUI":

                    var conceptDetails = d3.select("#" + property).select(function() {return this.parentNode});

                    conceptDetails.insert("h4", "#CUI")
                                  .attr("class", "detailstext")
                                  .attr("id", "identifiersHeader")
                                  .html("Identifiers");

                    sideBarElement.html("<strong>CUI: </strong> " + sideBarDetails[property]);
                    break;

                case "definition":

                    // TODO: maybe bold text of definition source (e.g. MEDLINE, CSP, etc.)

                    // TODO: Only create overflow in case text actually is heigher than 6 * lineHeight

                    var elementHeight;
                    var numberOfLines = 6;

                    sideBarElement.style("height", function()
                                                    {
                                                        var lineHeight = $("#" + property).css("line-height");
                                                        lineHeight = parseInt(lineHeight.slice(0,-2));
                                                        elementHeight = String(lineHeight * numberOfLines) + "px";
                                                        return elementHeight
                                                    });

                    var definition = sideBarDetails[property];
                    definition = stripHTML(definition);

                    // put each definition on a separate line, by replacing the separators (.,) by breaks
                    definition = definition.replace(/\.,/g, ".<br>");
                    htmlInsert = "<p class=\"test\"><em>" + definition + "</em></p><p class=\"readMore\"><a href=\"#\" " +
                                 "class=\"expandButton btn btn-default btn-sm\">Read More</a></p>"

                    sideBarElement.html(htmlInsert);

                    // TODO: behavior needs refinement; sidebar column becomes narrower on click, causing the need to
                    // TODO: click twice to get the full text; button click should also cause collapse; change button
                    // TODO: text when expanded.

                    // code courtesy of https://css-tricks.com/text-fade-read-more/
                    $(".expander .expandButton").click(function()
                    {
                        var $el, $ps, $up, totalHeight;

                        totalHeight = 0;

                        $el = $(this);
                        $p  = $el.parent();
                        $up = $p.parent();
                        $ps = $up.find("p");

                        // measure how tall inside should be by adding together heights of all inside paragraphs (except read-more paragraph)
                        $ps.each(function() {
                            totalHeight += $(this).outerHeight();
                        });

                        $up
                            .css(
                            {
                                // Set height to prevent instant jumpdown when max height is removed
                                "height": $up.height(),
                                "max-height": 9999
                            })
                            .animate(
                            {
                                "height": totalHeight
                            })
                            .click(function() {
                                //After expanding, click paragraph to revert to original state
                                $p.fadeIn();
                                $up.animate(
                                    {
                                        "height": elementHeight
                                    });
                            });

                        // fade out read-more
                        //$p.fadeOut();

                        // prevent jump-down
                        return false;

                    });

                    break;

                case "conceptName":
                    sideBarElement.html(sideBarDetails[property]);
                    break;

                case "prefLabel":
                    if (sideBarDetails[property] != clickedElement.conceptName)
                    {
                        sideBarElement.html("<strong>Preferred Label:</strong> " + sideBarDetails[property]);
                    }
                    break;

                case "semType":

                    sideBarElement = d3.select("h4#conceptName");

                    baseHTML = " (";

                    for (semType in sideBarDetails[property])
                    {

                        var semTypeIndex = getIndex("abbreviation", sideBarDetails[property][semType], semTypeJSON);
                        var semTypeFullName = semTypeJSON[semTypeIndex].fullName;

                        baseHTML = baseHTML + "<abbr title=\"" + semTypeFullName + "\">" + sideBarDetails[property][semType] +
                                    "</abbr>, ";
                    }

                    htmlInsert = baseHTML.slice(0, -2) + ")";

                    sideBarElement.insert("span")
                                  .attr("id", "semType")
                                  .html(htmlInsert);

                    break;

                case "doID":
                    url = "http://disease-ontology.org/term/DOID%3AUID/";
                    baseHTML = "<strong><abbr title=\"Disease Ontology Identifier\">DOID</abbr>:</strong> ";

                    htmlInsert = identifierHTML(sideBarDetails[property], url, baseHTML);
                    sideBarElement.html(htmlInsert);
                    break;

                case "GHRID":
                    url = "http://ghr.nlm.nih.gov/condition/" + sideBarDetails[property];
                    baseHTML = "<strong><abbr title=\"Genetics Home Reference\">GHR</abbr> ID:</strong> ";

                    htmlInsert = baseHTML + "<a href=\"" + url + "\" target=\"_blank\">" + sideBarDetails[property] + "</a>";
                    sideBarElement.html(htmlInsert);
                    break;

                case "icd9ID":
                    url = "http://www.icd9cm.net/default.asp?room=Di&typex=T&show=2dec&code=UID&prefix=";
                    baseHTML = "<strong><abbr title=\"International Classification of Diseases\">ICD</abbr>-9 " +
                        "ID:</strong> ";

                    htmlInsert = identifierHTML(sideBarDetails[property], url, baseHTML);
                    sideBarElement.html(htmlInsert);
                    break;

                case "icd10ID":
                    url = "http://apps.who.int/classifications/icd10/browse/2015/en#/UID";
                    baseHTML = "<strong><abbr title=\"International Classification of Diseases\">ICD</abbr>-10 " +
                        "ID:</strong> ";

                    htmlInsert = identifierHTML(sideBarDetails[property], url, baseHTML);
                    sideBarElement.html(htmlInsert);
                    break;

                case "OMIMID":

                    baseHTML = "<strong><abbr title=\"Online Mendelian Inheritance in Man\">OMIM</abbr> ID:</strong> ";

                    if (sideBarDetails[property].length <= 6)
                    {
                        if (sideBarDetails["seeAlso"])
                        {
                            htmlInsert = baseHTML + "<a href=\"" + sideBarDetails["seeAlso"][0] + "\" target=\"_blank\">" +
                                         sideBarDetails[property] + "</a>";
                        }
                        else
                        {
                            htmlInsert = baseHTML + "<a href=\"http://omim.org/entry/" + sideBarDetails[property] +
                                         "\" target=\"_blank\">" + sideBarDetails[property] + "</a>"
                        }
                    }
                    else if (sideBarDetails[property].length > 6)
                    {
                        var omimIDs = sideBarDetails[property].split(":");
                        omimIDs.sort();
                        url = "http://omim.org/entry/UID";

                        htmlInsert = identifierHTML(omimIDs, url, baseHTML);
                    }

                    sideBarElement.html(htmlInsert);
                    break;

                case "orphanetID":
                    url = "http://www.orpha.net/consor/cgi-bin/OC_Exp.php?Lng=GB&Expert=UID";
                    baseHTML = "<strong>Orphanet ID:</strong> ";

                    htmlInsert = identifierHTML(sideBarDetails[property], url, baseHTML);
                    sideBarElement.html(htmlInsert);
                    break;

                case "snomedID":
                    url = "http://schemes.caregraf.info/snomed#!UID";
                    baseHTML = "<strong>SNOMED-CT ID:</strong> ";

                    htmlInsert = identifierHTML(sideBarDetails[property], url, baseHTML);
                    sideBarElement.html(htmlInsert);
                    break;

                case "uniprotID":
                    url = "http://www.uniprot.org/uniprot/UID";
                    baseHTML = "<strong><abbr title=\"Universal Protein Resource\">UniProt</abbr> ID:</strong> ";

                    htmlInsert = identifierHTML(sideBarDetails[property], url, baseHTML);
                    sideBarElement.html(htmlInsert);
                    break;
            }
        }
    }


    $("#sidebar_loader").hide();
    $("#conceptdetails").show();
    $("#accordion").show();

    collapseLegend();

}

function stripHTML(html)
{
    var div = document.createElement("div");
    div.innerHTML = html;
    var text = div.textContent || div.innerText || "";

    return text
}

function identifierHTML(array, url, baseHTML)
{
    for (identifier in array)
    {
        var identifierURL = url.replace("UID", array[identifier]);

        var identifierHTML = "<a href=\"" + identifierURL + "\" target=\"_blank\">" + array[identifier] + "</a>, ";
        baseHTML = baseHTML + identifierHTML;
    }

    var htmlInsert = baseHTML.slice(0, -2);

    return htmlInsert
}

// function that takes a function as input and ensures that it is only executed once.
// Couteresy of http://davidwalsh.name/javascript-once
function once(fn, context) {

    var result;

    // return a function that loads the results if there is a function specified, and sets the function to null
    // (disabling it from running again), and returns the results
    return function() {
        if(fn) {
            result = fn.apply(context || this, arguments);
            fn = null;
        }

        return result;
    };
}

// collapse a node
function collapseNode(node)
{
    // filter the links; considering that we want to collapse the "node", we want to remove all links to / from the node
    // except its reference statement (statement through which it was created in the visualization). Therefore, the
    // source and target CUI of any link cannot be equal to the CUI of the clicked node, or the link should be the
    // reference statement
    links = links.filter(function(element)
                                {
                                    return (element.source.CUI != node.CUI && element.target.CUI != node.CUI) ||
                                           (element.statementID == node.referenceStatement)
                                });

    // update the degree counts based on the new links array
    updateDegreeCounts(nodes, links);

    // filter out the nodes that have a degree that is 0; thus only retain nodes with a degree larger
    // than zero
    nodes = nodes.filter(function(element)
                                {
                                    return element.degree > 0
                                });

    // reset the clickCount of the node such that the links will be loaded in the same order when the node is re-clicked;
    // also set the expanded status of the node to false so that we know that the node isn't expanded anymore
    node.clickCount = 0;
    node.expanded = false;

    // redraw the graph
    draw(nodes, links);

}

// update the degree values of the nodes
function updateDegreeCounts()
{

    // loop through the nodes
    for (var node in nodes)
    {

        // the degree is the number of links that come into and go from a particular node. By filtering the links array
        // based on the source and target indices we only keep the links that come into or go from a particular node.
        // The length of this array thus gives us the degree. Since nodes can be referred to with both objects and
        // indices, we include both options in our filter function
        var degree = links.filter(function(element)
                                    {
                                        return element.source == node || element.source.CUI == nodes[node].CUI ||
                                               element.target == node || element.target.CUI == nodes[node].CUI
                                    }).length;

        // set the degree of the node to the computed value
        nodes[node].degree = degree;
    }
}

// function that composes a list of nodes (including child nodes that are expanded) that need to be collapsed when
// clickedNode is right clicked
function getCollapseList(clickedNode)
{

    // initialize an empty array for storing the nodes that need to be collapsed
    var collapseList = [];

    // set the list of nodes that need to be checked to the clicked node
    var checkList = [clickedNode];

    // the collapseList is returned by the getExpandedChildNodes function when providing the checkList and the
    // collapseList
    collapseList = getExpandedChildNodes(checkList, collapseList);

    //console.log("Final collapseList", collapseList)

    // return the collapseList to the caller function
    return collapseList
}

// function that gets the child nodes of a list of nodes that are expanded (and thus also have childs) and stores the
// expanded nodes that need to be collapsed in a list
function getExpandedChildNodes(checkList, collapseList)
{
    //console.log("Checking expanded child nodes for following array of nodes ", checkList, "\n")

    // loop through the items (nodes) in the list of nodes that need to be checked for expanded child nodes
    for (item in checkList) {
        //console.log("Checking expanded child nodes for ", checkList[item]);

        // since the item (node) that we are currently checking is known to be expanded / have children, we know that
        // this node needs to be collapsed. Therefore we add it to the collapseList
        collapseList.push(checkList[item]);

        // filter all nodes in the graph such that only the expanded child nodes remain. In order for a node to be an
        // expanded child node, it has to conform to four criteria:
        // 1. It should be expanded
        // 2. It cannot be the reference node of the item (node) being checked since that would make it the parent
        // 3. The reference node of the node (it) should be the item (node) that is being checked to prevent that non-child
        //    nodes that have a relation to the item (node) from being considered as children, and thus being collapsed, as well
        // 4. It has to be involved in a relationship with the item (node) that is being checked for expanded child nodes
        var expandedChildNodes = nodes.filter(function (node) {
            return node.expanded == true &&
                node.CUI != checkList[item].referenceNode &&
                node.referenceNode == checkList[item].CUI &&
                links.filter(function (link) {
                    return (
                        link.source.CUI == node.CUI &&
                        link.target.CUI == checkList[item].CUI
                        ) || (
                        link.source.CUI == checkList[item].CUI &&
                        link.target.CUI == node.CUI
                        )
                }).length > 0
        });

        //console.log(checkList[item], "has the following expanded childnodes ", expandedChildNodes, "\n")

        // in case the item (node) being check has expanded child nodes, we should checked those child nodes for
        // potential expanded child nodes too
        if (expandedChildNodes.length > 0) {
            //console.log("recurse")
            getExpandedChildNodes(expandedChildNodes, collapseList)
        }
    }
    // return the list with nodes that are to be collapsed
    return collapseList
}

// generate a list with categories and assign them a color
function generateCategoryList()
{
    // color palette we want to use, courtesy of http://tools.medialab.sciences-po.fr/iwanthue/, selecting a color
    // palette of 18 colors, including the colors we use for the borders of the nodes
    var colorPalette =
        ["#CC9E73",
        "#61CDA3",
        "#D1BF3A",
        "#D8DEC9",
        "#7CC7D1",
        "#AAD08C",
        "#BE74A0",
        "#5C95CE",
        "#638733",
        "#A8A9D4",
        "#425876",
        "#CE963B",
        "#BFD956",
        "#7570D1",
        "#4C6034"];

    // define an empty global array in which we store the categories
    var categoryList = [];

    // loop through the JSON file containing all the semantic types
    for (var semType in semTypeJSON)
    {

        // get the index (in the category list) of the category of a semantic type
        var categoryIndex = getIndex("categoryName", semTypeJSON[semType]["category"], categoryList);

        // if the category does not yet exist in the category list, we add it to the list
        if (categoryIndex == -1)
        {
            var category = new Object;
            category["categoryName"] = semTypeJSON[semType]["category"];

            // the color of the category is equal to the color at the index of the length of the category list
            category["hexColor"] = colorPalette[categoryList.length];
            categoryList.push(category);
        }
    }

    return categoryList
}

function generateSideBarCategoryLegend(categoryList)
{
    categoryList.sort(function(category1, category2) {return (category1.categoryName > category2.categoryName) -
                                                             (category1.categoryName < category2.categoryName)});

    d3.select("h4#legendheader > a").html("Semantic Type Categories")

    var nOfCategories = categoryList.length;
    var columnID;

    for (var category in categoryList)
    {
        if (category <= (Math.floor(nOfCategories / 2) - 1))
        {
            columnID = "#legendleft"
        }
        else
        {
            columnID = "#legendright"
        }

        var parentWidth = d3.select("div" + columnID).node().getBoundingClientRect().width;
        var circleRadius = 7;
        var svgWidth = circleRadius * 2 + 10;

        // take an additional 10 pixels from the span width to prevent the box with semantic types to become
        // ugly on a vertical overflow; hardcoding is bad, I know, couldn't find another option though...
        var spanWidth = parentWidth - svgWidth - 10;

        var legendItem = d3.select("div" + columnID).append("div")
                                                    .attr("class", "legenditem")
                                                    .attr("width", parentWidth);

        var legendItemCircle = legendItem.append("svg")
                                         .attr("width", svgWidth)
                                         .append("circle")
                                         .attr("r", circleRadius)
                                         .style("fill", function() {return categoryList[category].hexColor});

        var legendItemText = legendItem.append("div")
                                       .attr("class", "categorylabel")
                                       .style("width", String(spanWidth) + "px")
                                       .html(categoryList[category].categoryName);

        var spanHeight = legendItemText.node().getBoundingClientRect().height;
        var minSVGHeight = circleRadius * 2 + 10;
        var svgHeight;
        if (spanHeight < minSVGHeight)
        {
            svgHeight = minSVGHeight;
            legendItemHeight = svgHeight;

        }
        else
        {
            svgHeight = spanHeight;
        }
        var legendItemHeight = svgHeight;

        legendItem.style("height", String(legendItemHeight) + "px");
        legendItem.select("svg").attr("height", svgHeight);

        //console.log(legendItemCircle)
        legendItemCircle.attr("cx", 0.5 * svgWidth)
                        .attr("cy", 0.5 * svgHeight);


    }
}

// determine whether the semantic type legend should be collapsed or expanded
function collapseLegend()
{
    // select the sidebar element and get its scrollHeight and clientHeight, to determine whether the content is overflowing
    var sidebar = d3.select("#sidebar").node();
    var scrollHeight = sidebar.scrollHeight;
    var clientHeight = sidebar.clientHeight;

    // check whether the legend currently is collapsed, if that's the case ...
    if (d3.select("#legendcontent.in").empty())
    {
        var detailsHeight;

        // we get the height of the current block of details that is (will be) displayed, which is either the
        // concept- or linkdetails block. We set the detailsHeight variable accordingly
        if ($("#conceptdetails").css("display") == "none")
        {
            detailsHeight = $("#linkdetails").outerHeight();
        }
        else if ($("#linkdetails").css("display") == "none")
        {
            detailsHeight = $("#conceptdetails").outerHeight();
        }

        // get the top and bottom padding of the sidebar to determine when an overflow will occur
        var topPadding = parseFloat($("#sidebar").css("padding-top"));
        var bottomPadding = parseFloat($("#sidebar").css("padding-bottom"));

        // this is the case if the height of the details block and the height of the legend together are smaller
        // than the available space (clientHeight) minus the top and bottom padding
        if (detailsHeight + legendHeight < clientHeight - topPadding - bottomPadding)
        {
            // if no overflow will result, we show the legend
            $("#legendcontent").collapse("show");
        }

    }

    // in case the legend is expanded...
    else
    {
        // we collapse it in case an overflow will occur, and thus the scrollHeight is larger than the clientHeight
        if (scrollHeight > clientHeight)
        {
            $("#legendcontent").collapse("hide");
        }
    }
}

function populateConceptModal(modalDetails, clickedElement)
{

    // before injecting the new html we should actually empty the contents of the .detailstext elements and delete
    // the identifiersHeader as that is injected on the fly. Furthermore we set the height of the definition box to 0
    // to prevent a lot of spacing in case no definition is available
    d3.selectAll("#conceptdetailsmodal .modal-body .modaltext").html("");
    d3.selectAll("#conceptdetailsmodal h3.modal-title > span").html("");
    d3.selectAll("#conceptdetailsmodal .modal-body .modalheader").remove();
    //d3.select("#definition").style("height", 0);

    var modalProperties = ["conceptName", "CUI", "conceptID", "definition", "prefLabel", "semType", "doID", "GHRID",
                            "icd9ID", "icd10ID", "OMIMID", "orphanetID", "snomedID", "uniprotID"];

    var advancedModalProperties = ["clinicalFeatures", "description", "diagnosis", "inheritance", "molecularGenetics",
                                    "pathogenesis",  "populationGenetics"];

    //console.log("populating modal")

    for (var key in modalProperties)
    {
        //console.log(key)
        if (modalProperties[key] in modalDetails)
        {
            d3.select("#modal" + modalProperties[key]).style("margin-bottom", "2px");
        }
        else
        {
            d3.select("#modal" + modalProperties[key]).style("margin-bottom", 0);
        }
    }

    for (var property in modalDetails)
    {

        var parentElement = d3.select("#modal" + property).select(function() {return this.parentNode});

        //console.log(modalProperties.indexOf(property))
        var modalElement = d3.select("#modal" + property);

        if (modalProperties.indexOf(property) != -1)
        {
            //console.log(modalElement);

            var url;
            var baseHTML;
            var htmlInsert;

            switch (property)
            {
                // ***********************************************
                // ***********************************************
                // ************ BASIC CONCEPT DETAILS ************
                // ***********************************************
                // ***********************************************

                case "conceptID":
                    modalElement.html("<strong>Concept ID:</strong> " + modalDetails[property]);
                    break;

                case "CUI":

                    var header = addHeader(parentElement, property)
                    header.html("Identifiers")

                    modalElement.html("<strong>CUI: </strong> " + modalDetails[property]);
                    break;

                case "definition":

                    var header = addHeader(parentElement, property);
                    header.html("Definition");
                    header.style("margin-top", "0px");

                    // TODO: maybe bold text of definition source (e.g. MEDLINE, CSP, etc.)

                    var definition = modalDetails[property];
                    definition = stripHTML(definition);

                    // put each definition on a separate line, by replacing the separators (.,) by breaks
                    definition = definition.replace(/\.,/g, ".<br>");
                    htmlInsert = "<em>" + definition + "</em>"

                    modalElement.html(htmlInsert);

                    break;

                case "conceptName":

                    modalElement = d3.select("h3.modal-title > span#modal" + property);
                    modalElement.html(modalDetails[property]);
                    break;

                case "prefLabel":
                    if (modalDetails[property] != clickedElement.conceptName)
                    {
                        modalElement.html("<strong>Preferred Label:</strong> " + modalDetails[property]);
                    }
                    break;

                case "semType":

                    var header = addHeader(parentElement, property);
                    header.html("Semantic Type(s)");

                    baseHTML = "";

                    for (semType in modalDetails[property])
                    {

                        var semTypeIndex = getIndex("abbreviation", modalDetails[property][semType], semTypeJSON);
                        var semTypeFullName = semTypeJSON[semTypeIndex].fullName;

                        baseHTML = baseHTML + semTypeFullName + " (" + modalDetails[property][semType] + "), ";
                    }

                    htmlInsert = baseHTML.slice(0, -2);

                    modalElement.html(htmlInsert);

                    break;

                // ***********************************************
                // ***********************************************
                // ***************** IDENTIFIERS *****************
                // ***********************************************
                // ***********************************************

                case "doID":
                    url = "http://disease-ontology.org/term/DOID%3AUID/";
                    baseHTML = "<strong><abbr title=\"Disease Ontology Identifier\">DOID</abbr>:</strong> ";

                    htmlInsert = identifierHTML(modalDetails[property], url, baseHTML);
                    modalElement.html(htmlInsert);
                    break;

                case "GHRID":
                    url = "http://ghr.nlm.nih.gov/condition/" + modalDetails[property];
                    baseHTML = "<strong><abbr title=\"Genetics Home Reference\">GHR</abbr> ID:</strong> ";

                    htmlInsert = baseHTML + "<a href=\"" + url + "\" target=\"_blank\">" + modalDetails[property] + "</a>";
                    modalElement.html(htmlInsert);
                    break;

                case "icd9ID":
                    url = "http://www.icd9cm.net/default.asp?room=Di&typex=T&show=2dec&code=UID&prefix=";
                    baseHTML = "<strong><abbr title=\"International Classification of Diseases\">ICD</abbr>-9 " +
                    "ID:</strong> ";

                    htmlInsert = identifierHTML(modalDetails[property], url, baseHTML);
                    modalElement.html(htmlInsert);
                    break;

                case "icd10ID":
                    url = "http://apps.who.int/classifications/icd10/browse/2015/en#/UID";
                    baseHTML = "<strong><abbr title=\"International Classification of Diseases\">ICD</abbr>-10 " +
                    "ID:</strong> ";

                    htmlInsert = identifierHTML(modalDetails[property], url, baseHTML);
                    modalElement.html(htmlInsert);
                    break;

                case "OMIMID":

                    baseHTML = "<strong><abbr title=\"Online Mendelian Inheritance in Man\">OMIM</abbr> ID:</strong> ";

                    if (modalDetails[property].length <= 6)
                    {
                        if (modalDetails["seeAlso"])
                        {
                            htmlInsert = baseHTML + "<a href=\"" + modalDetails["seeAlso"][0] + "\" target=\"_blank\">" +
                            modalDetails[property] + "</a>";
                        }
                        else
                        {
                            htmlInsert = baseHTML + "<a href=\"http://omim.org/entry/" + modalDetails[property] +
                            "\" target=\"_blank\">" + modalDetails[property] + "</a>"
                        }
                    }
                    else if (modalDetails[property].length > 6)
                    {
                        var omimIDs = modalDetails[property].split(":");
                        omimIDs.sort();
                        url = "http://omim.org/entry/UID";

                        htmlInsert = identifierHTML(omimIDs, url, baseHTML);
                    }

                    modalElement.html(htmlInsert);
                    break;

                case "orphanetID":
                    url = "http://www.orpha.net/consor/cgi-bin/OC_Exp.php?Lng=GB&Expert=UID";
                    baseHTML = "<strong>Orphanet ID:</strong> ";

                    htmlInsert = identifierHTML(modalDetails[property], url, baseHTML);
                    modalElement.html(htmlInsert);
                    break;

                case "snomedID":
                    url = "http://schemes.caregraf.info/snomed#!UID";
                    baseHTML = "<strong>SNOMED-CT ID:</strong> ";

                    htmlInsert = identifierHTML(modalDetails[property], url, baseHTML);
                    modalElement.html(htmlInsert);
                    break;

                case "uniprotID":
                    url = "http://www.uniprot.org/uniprot/UID";
                    baseHTML = "<strong><abbr title=\"Universal Protein Resource\">UniProt</abbr> ID:</strong> ";

                    htmlInsert = identifierHTML(modalDetails[property], url, baseHTML);
                    modalElement.html(htmlInsert);
                    break;

                //// ***********************************************
                //// ***********************************************
                //// ********** ADVANCED CONCEPT DETAILS ***********
                //// ***********************************************
                //// ***********************************************
                //
                //case "clinicalFeatures":
                //
                //    var header = addHeader(modalBody, property);
                //    header.html("Clinical Features");
                //
                //    sideBarElement.html(sideBarDetails[property]);
                //    break;
                //
                //case "description":
                //
                //    var header = addHeader(modalBody, property);
                //    header.html("Description");
                //
                //    sideBarElement.html(sideBarDetails[property]);
                //    break;
                //
                //case "diagnosis":
                //
                //    var header = addHeader(modalBody, property);
                //    header.html("Diagnosis");
                //
                //    sideBarElement.html(sideBarDetails[property]);
                //    break;
                //
                //case "inheritance":
                //
                //    var header = addHeader(modalBody, property);
                //    header.html("Inheritance");
                //
                //    sideBarElement.html(sideBarDetails[property]);
                //    break;
                //
                //case "molecularGenetics":
                //
                //    var header = addHeader(modalBody, property);
                //    header.html("Molecular Genetics");
                //
                //    sideBarElement.html(sideBarDetails[property]);
                //    break;
                //
                //case "pathogenesis":
                //
                //    var header = addHeader(modalBody, property);
                //    header.html("Pathogenesis");
                //
                //    sideBarElement.html(sideBarDetails[property]);
                //    break;
                //
                //case "populationGenetics":
                //
                //    var header = addHeader(modalBody, property);
                //    header.html("Population Genetics");
                //
                //    sideBarElement.html(sideBarDetails[property]);
                //    break;
            }
        }

        if (advancedModalProperties.indexOf(property) != -1)
        {
            var header = addHeader(parentElement, property);
            htmlInsert = camelCaseToRegularForm(property);
            header.html(htmlInsert);

            modalElement.html(modalDetails[property]);
        }
    }

}

// add a header above an element with "modal" + property as id
function addHeader(parentElement, propertyHeader)
{
    var header = parentElement.insert("h4", "#modal" + propertyHeader)
                              .attr("class", "modalheader")
                              .attr("id", "modal" + propertyHeader + "Header");

    return header;
}

// convert a camel cased string to a string with uppercase first letters
// code courtesy of http://stackoverflow.com/questions/4149276/javascript-camelcase-to-regular-form
function camelCaseToRegularForm(string)
{
    // insert a space before all caps
    string = string.replace(/([A-Z])/g, ' $1');
    // uppercase the first character
    string = string.replace(/^./, function(str){ return str.toUpperCase(); });

    return string;
}

function generateLinkModal(clickedElement, modalDetails)
{
    var statementID = clickedElement.statementID;

    var buttonClickCount = 0;

    $.when(ajaxCitationsSentences(statementID, buttonClickCount))
        .then(function(response)
        {
            modalDetails.citations = [];
            modalDetails = handleCitationsSentencesJSON(response, modalDetails);

            modalDetails = populateLinkModal(modalDetails);
            //console.log(modalDetails)

            var loadButton = d3.select("#loadSentencesButton");
            var nOfDisplayedSentences = 0;

            for (var citation in modalDetails["citations"])
            {
                nOfDisplayedSentences += modalDetails["citations"][citation]["sentences"].length;
            }

            var loaderspan = d3.select("#loadSentencesButton > span").node().outerHTML;

            if (nOfDisplayedSentences == modalDetails.sentencesCount)
            {
                loadButton.style("display", "none");
            }
            else
            {
                loadButton.attr("disabled", null)
                          .style("display", null)
                          .html(loaderspan + "Load more sentences");
            }

            loadButton.on("click", function()
                                    {

                                        buttonClickCount++;
                                        //console.log(buttonClickCount)

                                        $.when(ajaxCitationsSentences(statementID, buttonClickCount)
                                            .then(function(response)
                                            {
                                                modalDetails = handleCitationsSentencesJSON(response, modalDetails);

                                                modalDetails = populateLinkModal(modalDetails);

                                                $("#loadSentencesButton").toggleClass("active");

                                                nOfDisplayedSentences = 0;

                                                for (var citation in modalDetails["citations"])
                                                {
                                                    nOfDisplayedSentences += modalDetails["citations"][citation]["sentences"].length;
                                                }

                                                if (nOfDisplayedSentences == modalDetails.sentencesCount)
                                                {
                                                    loadButton.attr("disabled", "disabled")
                                                              .html(loaderspan + "All sentences loaded");
                                                }

                                                //console.log(modalDetails)
                                            }))
                                    })
        })

}

function ajaxCitationsSentences(statementID, clickCount)
{
    //console.log("enter getCitationsSentences");

    var sparqlLimit = 50;

    var sparqlQuery =

        "PREFIX : <http://purl.org/net/fcnmed/> " +
        "PREFIX dc: <http://purl.org/dc/terms/> " +
        "PREFIX bibo: <http://purl.org/ontology/bibo/> " +

        "SELECT ?pmid, ?issn, ?pyear, ?pmonth, ?pSameAs, ?sentenceID, ?sentenceLocation, ?sentenceContent " +

        "WHERE " +
        "{ " +
            "?statement rdf:type rdf:Statement. " +

            "?statement dc:source ?article. " +
            "?article rdf:type bibo:AcademicArticle. " +
            "?article bibo:issn ?issn. " +
            "?article bibo:pmid ?pmid. " +
            "?article :publicationYear ?pyear. " +
            "?article owl:sameAs ?pSameAs. " +

            "OPTIONAL " +
            "{ " +
                "?article :publicationMonth ?pmonth. " +
            "} " +

            "?statement :derivedFrom ?sentence. " +
            "?sentence rdf:type :Sentence. " +
            "?sentence dc:isPartOf ?article. " +
            "?sentence :hasSentenceID ?sentenceID. " +
            "?sentence :sentenceLocation ?sentenceLocation. " +
            "?sentence :content ?sentenceContent. " +

            "?statement :hasStatementID " + statementID + ". " +

        "} LIMIT " + sparqlLimit + " OFFSET " + (sparqlLimit * clickCount);

    //console.log(sparqlQuery);

    var queryParameters =
    {
        "default-graph-uri": graphURL,
        "query": sparqlQuery,
        "debug": "on",
        "timeout": "",
        "format": "application/json",
        "save": "display",
        "fname": ""

    };

    var endpointBaseURL = "http://virtuosop.ddmgraph-uva.vm.surfsara.nl/cache/index.php?server=local&";
    var endpointQueryURL = "";

    for (var parameter in queryParameters)
    {
        endpointQueryURL = endpointQueryURL + parameter + "=" + encodeURIComponent(queryParameters[parameter]) + "&";
    }

    var endpointURL = endpointBaseURL + endpointQueryURL;
    //console.log(endpointURL)

    //console.log("returning $.ajax")

    return $.ajax(
        {

            url: endpointURL,
            data:
            {
                format: "json"
            }//,
            //success: function( response ) {
            //    console.log("Success");
            //    graph = response;
            //    console.log(graph);
            //    getNodes(graph);
            //},
            //
            //error: function(jqXHR, textStatus, errorThrown)
            //{
            //    console.log(textStatus, errorThrown);
            //}
        });
}

// TODO: incorporate Bio2RDF call if pubmed.bio2rdf is up again
function handleCitationsSentencesJSON(citationsSentencesJSON, modalDetails)
{
    var results = citationsSentencesJSON["results"]["bindings"];
    var citationProperties = ["issn", "pmid", "pmonth", "pyear", "pSameAs"];
    //var tempCitations = [];

    if (!modalDetails.citations)
    {
        //console.log("create citations array")
        modalDetails["citations"] = [];
    }

    for (var row in results)
    {
        //console.log(modalDetails.citations);
        var citationIndex = getIndex("pmid", results[row]["pmid"]["value"], modalDetails.citations);
        //var tempCitationsIndex = getIndex("pmid", results[row]["pmid"]["value"], tempCitations);

        if (citationIndex == -1 /*&& tempCitationsIndex == -1*/)
        {
            var tempCitation = new Object;
            tempCitation["sentences"] = [];

            var tempSentence = new Object;

            for (var property in results[row])
            {

                if (citationProperties.indexOf(property) != -1)
                {
                   tempCitation[property] = results[row][property]["value"];
                }
                else
                {
                    tempSentence[property] = results[row][property]["value"];
                }
            }

            tempCitation["sentences"].push(tempSentence);
            modalDetails["citations"].push(tempCitation);
            //tempCitations.push(tempCitation);
        }
        //else if (citationIndex == -1 && tempCitationsIndex != -1)
        //{
        //    var tempCitation = tempCitations[tempCitationsIndex]
        //
        //    var tempSentence = new Object;
        //
        //    for (var property in results[row])
        //    {
        //        if (citationProperties.indexOf(property) == -1)
        //        {
        //            tempSentence[property] = results[row][property]["value"];
        //        }
        //    }
        //
        //    tempCitation["sentences"].push(tempSentence);
        //}

        else
        {
            var citation = modalDetails["citations"][citationIndex];
            //console.log(citation)

            var tempSentence = new Object;

            for (var property in results[row])
            {
                if (citationProperties.indexOf(property) == -1)
                {
                    tempSentence[property] = results[row][property]["value"];
                }
            }
            citation.sentences.push(tempSentence);
        }
    }

    return modalDetails
}

function populateLinkModal(modalDetails)
{
    // before injecting the new html we should actually empty the contents of the .detailstext elements and delete
    // the source- and targetHeaders as those are injected on the fly.
    //d3.selectAll("#linkdetails > p.detailstext").html("");
    //d3.selectAll("#linkdetails > em > span").html("");
    d3.selectAll("#linkdetailsmodal .modalheader").remove();

    for (var property in modalDetails)
    {
        var modalElement = d3.select("#modal" + property);

        switch (property)
        {
            case "citations":

                var htmlInsert = generateCitationsHTML(modalDetails[property]);
                modalElement.html(htmlInsert);

                break;

            case "citationsCount":
                modalElement.html("<strong><abbr title=\"The number of unique articles in which a statement " +
                "occurs\">Citations count:</abbrv></strong> " + String(modalDetails[property]));
                break;

            case "predicate":
                modalElement.html(modalDetails[property]);
                break;

            case "sentencesCount":
                modalElement.html("<strong><abbr title=\"The number of unique sentences from which a statement is " +
                "derived\">Sentences count:</abbr></strong> " + String(modalDetails[property]));
                break;

            case "source":
                handleLinkObject(modalDetails, property, "modal");
                break;

            case "statementID":

                var parentElement = modalElement.select(function() {return this.parentNode});

                var header = addHeader(parentElement, property)
                header.html("Summary");

                modalElement.html("<strong>Statement ID:</strong> " + modalDetails[property]);

                modalElement = d3.select("#modalstatementID2")
                                 .html(modalDetails[property]);
                break;

            case "target":
                handleLinkObject(modalDetails, property, "modal");
                break;
        }
    }

    return modalDetails
}

function generateCitationsHTML(citations)
{
    var citationsHTMLInsert = "";

    for (var citation in citations)
    {
        var citationDetails = new Object;

        for (var property in citations[citation])
        {
            if (property == "sentences")
            {
                var sentenceHTML = "";

                for (var sentence in citations[citation][property])
                {
                    //console.log(citations[citation][property])

                    sentenceHTML = sentenceHTML + "<p class=\"modaltext sentence\">" + citations[citation][property][sentence].sentenceContent + "</p>"
                }

                citationDetails[property] = sentenceHTML

                continue;
            }

            citationDetails[property] = citations[citation][property]

        }

        var citationHTML =
        "<div class=\"row\">" +
            "<div class=\"col-sm-12\">" +
                "<h4 class=\"publicationheader\">Publication #" + citationDetails.pmid + "</h4>" +
                "<div class=\"row\">" +
                    "<div class=\"col-sm-8\">" +
                        "<h5 class=\"publicationsentenceheader\">Sentence(s)</h5>" +
                        citationDetails.sentences +
                    "</div>" +
                    "<div class=\"col-sm-4\">" +
                        "<h5 class=\"publicationdetailsheader\">Publication Details</h5>" +
                        "<p class=\"modaltext\">" +
                            "<strong>" +
                                "Publication Date:" +
                            "</strong> " + getMonth(citationDetails.pmonth) + citationDetails.pyear +
                        "</p>" +
                        "<p class=\"modaltext\">" +
                            "<strong>PubMed ID:</strong> " +
                            "<a href=\"http://www.ncbi.nlm.nih.gov/pubmed/" + citationDetails.pmid + "/\" target=\"_blank\">" +
                                citationDetails.pmid +
                            "</a>" +
                        "</p>" +
                        "<p class=\"modaltext\">" +
                            "<strong>" +
                                "<abbr title=\"International Standard Serial Number\">ISSN</abbr>:" +
                            "</strong> " + citationDetails.issn +
                    "</div>" +
                "</div>" +
            "</div>" +
        "</div>"

        citationsHTMLInsert = citationsHTMLInsert + citationHTML;
    }

    //console.log(citationsHTMLInsert)
    return citationsHTMLInsert
}

function getMonth(monthNumber)
{
    var monthArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
                        "November", "December"];

    if (monthNumber == undefined)
    {
        return "";
    }
    else
    {
        return monthArray[monthNumber -1] + " ";
    }
}

$(function(){
    $('#loadSentencesButton').click(function() {
        $(this).toggleClass('active');
    });
});