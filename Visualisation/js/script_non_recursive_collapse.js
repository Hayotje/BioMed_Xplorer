/**
 * Created by Hayo on 7-7-2015.
 */

var initializeCUI = "C0011860"
var nodes = [];
var links = [];

var graphURL = "http://fcngroup.nl";
//getStatements("C0011860");
//getNodesStatic();
initializeSVG();

function initializeSVG()
{
    svgWidth = d3.select("#graph_wrapper").node().getBoundingClientRect().width;
    svgHeight = window.innerHeight - d3.select(".navbar").node().getBoundingClientRect().height;

    svg = d3.select("#graph_wrapper").append("svg")
            .attr("class", "graph")
            .attr("width", svgWidth)
            .attr("height", svgHeight);

    generateMarker();

    setNodeToolTip();
    setLinkToolTip();

    force = d3.layout.force()
              .size([svgWidth, svgHeight])
              .linkDistance(svgWidth / 20)
              .charge(-100);

    getStatements(initializeCUI, 0);
    //getNodesStatic();
}

function getStatements(queryCUI, clickCount)
{

    var sparqlLimit = 30;

    var sparqlQuery = "PREFIX : <http://www.semanticweb.org/hayo/ontologies/2015/5/SemMed_Ontology/> " +

        "SELECT DISTINCT ?statementID, ?subjectName, ?subjectCUI, ?subjectConceptID, ?subjectSemType, ?predicate, " +
        "?objectName, ?objectCUI, ?objectConceptID, ?objectSemType " +

        "WHERE { " +

            "?statement rdf:type rdfs:Statement; " +
            ":hasStatementID ?statementID. " +

            "?statement rdfs:subject ?subject. " +
            "?subject rdf:type skos:Concept; " +
                     ":hasName ?subjectName; " +
                     ":hasCUI ?subjectCUI; " +
                     ":hasSemanticType ?subjectSemType. " +
            "OPTIONAL {?subject :hasConceptID ?subjectConceptID.} " +

            "?statement rdfs:predicate ?predicate." +

            "?statement rdfs:object ?object." +
            "?object rdf:type skos:Concept;" +
                    ":hasName ?objectName; " +
                    ":hasCUI ?objectCUI; " +
                    ":hasSemanticType ?objectSemType. " +
            "OPTIONAL {?object :hasConceptID ?objectConceptID.} " +

            "{?object :hasCUI \"" + queryCUI + "\"^^<http://www.w3.org/2000/01/rdf-schema#Literal>} " +
            "UNION " +
            "{?subject :hasCUI \"" + queryCUI + "\"^^<http://www.w3.org/2000/01/rdf-schema#Literal>} " +

        "} LIMIT " + String(sparqlLimit) +  " OFFSET " + String(clickCount * sparqlLimit);

    console.log(sparqlQuery);

    var queryParameters =
    {
        "default-graph": graphURL,
        "query": sparqlQuery,
        "debug": "on",
        "timeout": "",
        "format": "application/json",
        "save": "display",
        "fname": ""

    };

    var endpointBaseURL = "http://virtuosop.ddmgraph-uva.vm.surfsara.nl/sparql?";
    var endpointQueryURL = "";

    for (var parameter in queryParameters)
    {
        endpointQueryURL = endpointQueryURL + parameter + "=" + encodeURIComponent(queryParameters[parameter]) + "&";
    }

    var endpointURL = endpointBaseURL + endpointQueryURL;
    console.log(endpointURL)

    $.ajax(
        {

            url: endpointURL,
            data:
            {
                format: "json"
            },
            success: function( response ) {
                console.log("Success");
                graph = response;
                console.log(graph);
                getNodes(graph);
            },

            error: function(jqXHR, textStatus, errorThrown)
            {
                console.log(textStatus, errorThrown);
            }
        });
}

function getNodes(graph)
{
    console.log("Ajax request completed");

    var statements = graph["results"]["bindings"];

    for (var i = 0; i < statements.length; i++)
    {

        console.log(i);

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


function getNodesStatic()
{

    d3.json("json/diabetes_statements_static.json", function (error, graphStatic)
    {
        if (error)
            throw error;

        console.log("Loading json completed");

        var statements = graphStatic["results"]["bindings"];

        for (var i = 0; i < statements.length; i++)
        {

            console.log(i);

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

    });
}

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

            console.log("source concept " + sourceConcept + "; target concept " + targetConcept)

            var sourceIndex = getIndex("CUI", sourceConcept, nodes);
            var targetIndex = getIndex("CUI", targetConcept, nodes);

            var tempLink = new Object;
            tempLink.statementID = statementID;
            tempLink.source = sourceIndex;
            tempLink.target = targetIndex;
            tempLink.predicate = predicate;

            /*
             Preparations for additional link attributes, indicating the number of citations and sentences from which
             a statement is derived respectively
             */
            //tempLink.nOfSentences = graphJSON[i]["nOfSentences"]["value"];
            //tempLink.nOfCitations = graphJSON[i]["nOfCitations"]["value"];

            links.push(tempLink);
        }
    }

    // FLAG
    updateDegreeCounts(nodes, links);

    //TODO: Add something here to differentiate between updating nodes and links (upon clicking a node) and on loading the visualization for the first time
    draw(nodes, links)
}

function draw(nodes, links)
{
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
        .style("stroke", "#777")
        .style("marker-end",  "url(#marker)");

    var timer = 0;
    var delay = 200;
    var singleClick = true;

    node = svg.selectAll(".node")
                  .data(nodes, function(d) {return d.CUI});

    node.exit().remove();

    node.enter()
        .append("circle")
        .attr("class", "node")
        .attr("cx", function(d) {return d.x;})
        .attr("cy", function(d) {return d.y;})
        .attr("r", svgWidth / 150)
        .on("mouseover", nodeToolTip.show)
        .on("mouseout", nodeToolTip.hide)
        .on("click", function(d)
        {
            // courtsey of https://css-tricks.com/snippets/javascript/bind-different-events-to-click-and-double-click/
            // set a timeout that triggers the click event after the delay in order to allow the user to
            // double click
            timer = setTimeout(function()
            {
                // in case the user clicked just one time, trigger the appropriate action
                if (singleClick)
                {
                    d.clickCount += 1;
                    getStatements(d.CUI, d.clickCount - 1);
                    doClickAction();
                }

                // set singleClick to true in order to allow single clicks after a double click
                singleClick = true;
            }, delay);
        })
        .on("dblclick", function()
        {
            // clear the timeout in case the user double clicks
            clearTimeout(timer);

            // set singleClick to false
            singleClick = false;

            // trigger the appropriate action
            doDoubleClickAction();
        })
        .on("contextmenu", function(d)
        {
            // prevent the context menu to pop up
            d3.event.preventDefault();

            // TODO: refine behavior in case a node with that has expanded child nodes is collapsed; detaches in current situation, should collapse all children
            // do not allow the central node (for which the visualization is initialized) to be collapsed
            if (d.referenceStatement != null)
            {
                // collapse the node
                collapseNode(d);
            }
        });

    force.on("tick", function()
{
    node.attr("cx", function(d) {return d.x;})
        .attr("cy", function(d) {return d.y;});

    link.attr("x1", function(d) {return d.source.x;})
        .attr("y1", function(d) {return d.source.y;})
        .attr("x2", function(d) {return d.target.x;})
        .attr("y2", function(d) {return d.target.y;});
});

}

// TODO: Refine marker arrow head
function generateMarker()
{
    var defs = d3.select("svg.graph").append("defs");

    defs.append("marker")
        .attr("id", "marker")
        .attr({
            "viewBox": "0 -5 10 10",
            "refX": 25,
            "refY": 0,
            "markerWidth": 6,
            "markerHeight": 6,
            "orient": "auto",
            "markerUnit": "strokeWidth"
        })
        .append("path")
        .attr("d", "M0,-5L10,0L0,5 L10,0 L0, -5")
        .style("stroke", "#777")
        .style("opacity", "0.6");
}

function setNodeToolTip()
{
    nodeToolTip = d3.tip()
                    .attr("class", "d3-tip")
                    .html(function(d) {return "<span>" + titleCaseConversion(d.name) + "</span>"})
                    .offset([-10, 0]);

    svg.call(nodeToolTip);
}

// TODO: refine link tooltip design and placement
function setLinkToolTip()
{
  linkToolTip = d3.tip()
                  .attr("class", "d3-tip")
                  .html("some text")
                  .offset([-10, 0]);

  svg.call(linkToolTip);
}

function addNode(nodePosition, graphJSON, subjectOrObject)
{
    console.log("node with this CUI does not yet exist");
    console.log(subjectOrObject);
    var tempNode = new Object;
    tempNode.CUI = graphJSON[nodePosition][subjectOrObject + "CUI"]["value"];
    tempNode.name = graphJSON[nodePosition][subjectOrObject + "Name"]["value"];
    tempNode.semType = [graphJSON[nodePosition][subjectOrObject + "SemType"]["value"]];
    tempNode.degree = null;

    if (graphJSON[nodePosition][subjectOrObject + "ConceptID"])
    {
        tempNode.conceptID = graphJSON[nodePosition][subjectOrObject + "ConceptID"]["value"];
    }
    if (graphJSON[nodePosition][subjectOrObject + "CUI"]["value"] == initializeCUI)
    {
        tempNode.clickCount = 1;

        // the node for which we initialize the graph has no statement in which it was first referred
        tempNode.referenceStatement = null;
    } else
    {
        tempNode.clickCount = 0;

        // for the other statements, the statement in which it was first referred is the statement with the ID in which
        // we first encountered it
        tempNode.referenceStatement = graphJSON[nodePosition]["statementID"]["value"];
    }
    /*
    Preparations for additional node attributes, indicating the number of incoming and outgoing links to respectively
     from the node
     */
    //tempNode.indegree = graphJSON[nodePosition][subjectOrObject + "Indegree"]["value"];
    //tempNode.outdegree = graphJSON[nodePosition][subjectOrObject + "Outdegree"]["value"];
    console.log(tempNode);

    nodes.push(tempNode);
}

function getIndex(identifyingProperty, identifier, array)
{
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

function doClickAction()
{
    console.log("single click registered")
}

function doDoubleClickAction()
{
    console.log("double click registered")
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
    updateDegreeCounts(nodes, links)

    // filter out the nodes that have a degree that is smaller that is 0; thus only retain nodes with a degree larger
    // than zero
    nodes = nodes.filter(function(element)
                                {
                                    return element.degree > 0
                                });

    // reset the clickCount of the node such that the links will be loaded in the same order when the node is clicked
    // again
    node.clickCount = 0;

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