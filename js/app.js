const global = window;
const docEl = document.documentElement;
const viewWidth = docEl.clientWidth;
const viewHeight = docEl.clientHeight;

const createPointGrid = (width, height, spacingX, spacingY) => {
    let currentY = 0;
    let points = [];
    while (currentY < height + spacingY) {
        let row = Math.floor(currentY / spacingY);
        let currentX = row % 2 === 0 ? 0 : spacingX / 2;
        while (currentX < width + spacingX) {
            points.push([currentX, currentY]);
            currentX += spacingX;
        }
        currentY += spacingY;
    }
    return points;
};

const hexagon = (cx, cy, radius) => [
    [cx, cy - radius],
    [cx + radius * Math.sqrt(3) / 2, cy - radius / 2],
    [cx + radius * Math.sqrt(3) / 2, cy + radius / 2],
    [cx, cy + radius],
    [cx - radius * Math.sqrt(3) / 2, cy + radius / 2],
    [cx - radius * Math.sqrt(3) / 2, cy - radius / 2]
];

const polygonSides = polygon =>
    _.zip(polygon, [...polygon.slice(1), polygon[0]]);

const hexagonSquares = (hexagon, radius) => {
    const sides = polygonSides(hexagon);
    const magicParam = 2 / (1 + 2 * Math.sqrt(3));

    const firstSide = sides[0];
    const square1 = [
        firstSide[0],
        firstSide[1],
        [
            firstSide[1][0] + radius / 2,
            firstSide[1][1] - radius * Math.sqrt(3) / 2
        ],
        [
            firstSide[0][0] + radius / 2,
            firstSide[0][1] - radius * Math.sqrt(3) / 2
        ]
    ];

    const square2 = [
        sides[1][0],
        sides[1][1],
        [sides[1][1][0] + radius, sides[1][1][1]],
        [sides[1][1][0] + radius, sides[1][1][1] - radius],
    ];

    const square3 = [
        sides[2][0],
        sides[2][1],
        [
            sides[2][1][0] + radius / 2,
            sides[2][1][1] + radius * Math.sqrt(3) / 2
        ],
        [
            sides[2][0][0] + radius / 2,
            sides[2][0][1] + radius * Math.sqrt(3) / 2
        ]
    ];

    const square4 = [
        sides[3][0],
        sides[3][1],
        [
            sides[3][1][0] - radius / 2,
            sides[3][1][1] + radius * Math.sqrt(3) / 2
        ],
        [
            sides[3][0][0] - radius / 2,
            sides[3][0][1] + radius * Math.sqrt(3) / 2
        ]
    ];

    const square5 = [
        sides[4][0],
        sides[4][1],
        [sides[4][1][0] - radius, sides[4][1][1]],
        [sides[4][1][0] - radius, sides[4][1][1] + radius],
    ];

    const square6 = [
        sides[5][0],
        sides[5][1],
        [
            sides[5][1][0] - radius / 2,
            sides[5][1][1] - radius * Math.sqrt(3) / 2
        ],
        [
            sides[5][0][0] - radius / 2,
            sides[5][0][1] - radius * Math.sqrt(3) / 2
        ]
    ];
    return [square4, square5, square6];  
};

const hexagonTriangles = (hexagon, radius) => {
    const triangle1 = [
        hexagon[0],
        [hexagon[0][0] + radius / 2, hexagon[0][1] - radius * Math.sqrt(3) / 2],
        [hexagon[0][0] - radius / 2, hexagon[0][1] - radius * Math.sqrt(3) / 2]
    ];
    const triangle2 = [
        hexagon[1],
        [hexagon[1][0] + radius, hexagon[1][1]],
        [hexagon[1][0] + radius / 2, hexagon[1][1] - radius * Math.sqrt(3) / 2]
    ];
    return [triangle1, triangle2]
};

const hexagonInnerTriangles = (hexagon, radius, [cx, cy]) => {
    const sides = polygonSides(hexagon);
    return [
        [sides[0][0], sides[0][1], [cx, cy]],
        [sides[2][0], sides[2][1], [cx, cy]],
        [sides[4][0], sides[4][1], [cx, cy]]
    ];
};

const quantizeValue = (value, size) => Math.round(value / size) * size;

const roundPoint = (values) => values.map(v => quantizeValue(v, 5))

const pointEq = ([x1, y1], [x2, y2]) => x1 == x2 && y1 == y2;

const mutateFills = fills => _.map(fills, (fill) =>
    fill + Stochator.fromDistribution.normal(0, 0.001));

const pointMutator = new Stochator(
    {}, {mean: 0, min: -20, max: 20, stdev: 10},
    ([threshold, change]) => threshold > 0.999 ? change : 0);

const mutatePoints = points => points.map(
    ([x, y], i) => [x + pointMutator.next(), y + pointMutator.next()]);

const reconstructPoints = (polygonIndexes, pointsByIndex) =>
    polygonIndexes.map(indexes =>
        indexes.map(index => pointsByIndex[index]));

const pointsToString = (points) =>
     points.map(point => point.join(",")).join(" ");

const hueGenerator = new Stochator(
    {mean: 1, min: 0, stdev: 0.5},
    (prev, increment) => prev + increment % 360);

const createColorScale = (hue) =>
    d3.scaleQuantize()
        .domain([0, 1])
        .range(
            d3.quantize(
                d3.interpolate(
                    d3.hsl(hue, minSaturation, minLightness),
                    d3.hsl(hue, maxSaturation, maxLightness)),
            4)
        );

const r = 80;

const [minSaturation, maxSaturation] = [0.25, 0.3];

const [minLightness, maxLightness] = [0.8, 0.92];

const initializeGlobalState = () => {
    const grid = createPointGrid(docEl.clientWidth,  docEl.clientHeight, r * 2.728, r * 2.3625);

    const hexagons = grid.map(([cx, cy]) => hexagon(cx, cy, r));

    const squares = _.flatten(hexagons.map(hexagon => hexagonSquares(hexagon, r)));

    const triangles = _.flatten(hexagons.map(hexagon => hexagonTriangles(hexagon, r)));

    const innerTriangles = _.flatten(
        _.zip(hexagons, grid).map(([hexagon, centroid]) =>
            hexagonInnerTriangles(hexagon, r, centroid)));

    const inputPolygons = _.concat(hexagons, squares, triangles, innerTriangles);

    const roundedPolygons = inputPolygons.map(polygon => polygon.map(roundPoint));

    const allPoints = _.flatten(roundedPolygons);

    const startingPoints = _.uniqWith(allPoints, pointEq);

    global.pointsIndexes = roundedPolygons.map(polygon =>
        polygon.map((p1) =>
            _.findIndex(startingPoints, (p2) => pointEq(p1, p2))));

    const startingPolygons = pointsIndexes.map(indexes =>
        indexes.map(index => startingPoints[index]));

    const startingHue = Stochator.randomInteger(0, 360);
    hueGenerator.setValue(startingHue);

    const startingFills = new Stochator().next(inputPolygons.length);

    global.hue = startingHue;
    global.colorScale = createColorScale(hue);
    global.fills = startingFills
    global.polygons = startingPolygons;
    global.points = startingPoints;

    global.stepIncrement = 100;
    global.running = true;
    global.timer = null;
};

const initialize = (reinit) => {

    d3.select("#svg")
        .selectAll("polygon.cell")
        .data(polygons)
        .enter()
        .append("polygon")
        .transition()
        .ease(d3.easeLinear)
        .duration(100)
        .attr("class", "cell")
        .attr("points", (points) => points.map(point => point.join(",")).join(" "))
        .attr("stroke-width", 1)
        .attr("stroke", colorScale(0))
        .attr("fill", (d, i) => colorScale(fills[i]));
};



const draw = (colorScale, fills, polygons) => {
    d3.select("body").style("background", colorScale(0));

    d3.select("#svg")
        .selectAll("polygon.cell")
        .data(polygons)
        .transition()
        .ease(d3.easeLinear)
        .duration(stepIncrement)
        .attr("points", pointsToString)
        .attr("stroke-width", 1)
        .attr("stroke", colorScale(0))
        .attr("fill", (d, i) => colorScale(fills[i]));
};

const step = () => {
    if (running) {
        colorScale = createColorScale(hueGenerator.next());
        fills = mutateFills(fills);
        points = mutatePoints(points);
        polygons = reconstructPoints(pointsIndexes, points);

        global.requestAnimationFrame(() => draw(colorScale, fills, polygons));
    }

    stepIncrement += Stochator.fromDistribution.normal(0.5, 0.01);
    global.timer = setTimeout(step, stepIncrement);
};

document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    console.log('Running', running);
});



window.addEventListener('resize', () => {
    initializeGlobalState();
    d3.select("svg")
        .selectAll("polygon.cell")
        .remove();
    initialize();
});

initializeGlobalState();
initialize();
step();