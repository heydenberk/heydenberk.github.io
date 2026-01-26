const global = window;
const docEl = document.documentElement;

const createPointGrid = (width, height, spacingX, spacingY) => {
    let currentY = -spacingY;
    let points = [];
    while (currentY < height + spacingY * 2) {
        let row = Math.floor((currentY + spacingY) / spacingY);
        let currentX = row % 2 === 0 ? -spacingX : -spacingX / 2;
        while (currentX < width + spacingX * 2) {
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
    return [triangle1, triangle2];
};

const hexagonInnerTriangles = (hexagon, radius, [cx, cy]) => {
    const sides = polygonSides(hexagon);
    return [
        [sides[0][0], sides[0][1], [cx, cy]],
        [sides[2][0], sides[2][1], [cx, cy]],
        [sides[4][0], sides[4][1], [cx, cy]]
    ];
};

const pointsToString = (points) =>
    points ? points.map(point => point.join(",")).join(" ") : "";

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

const mutateFills = fills => _.map(fills, (fill) =>
    fill + Stochator.fromDistribution.normal(0, 0.001));

const pointMutator = new Stochator(
    {}, {mean: 0, min: -20, max: 20, stdev: 10},
    ([threshold, change]) => threshold > 0.999 ? change : 0);

const mutateGridPoints = gridPoints => gridPoints.map(
    ([x, y]) => [x + pointMutator.next(), y + pointMutator.next()]);

const generatePolygons = (gridPoints) => {
    const hexagons = gridPoints.map(([cx, cy]) => hexagon(cx, cy, r));
    const squares = _.flatten(hexagons.map(h => hexagonSquares(h, r)));
    const triangles = _.flatten(hexagons.map(h => hexagonTriangles(h, r)));
    const innerTriangles = _.flatten(
        _.zip(hexagons, gridPoints).map(([h, centroid]) =>
            hexagonInnerTriangles(h, r, centroid)));
    return _.concat(hexagons, squares, triangles, innerTriangles);
};

const initializeGlobalState = () => {
    const width = docEl.clientWidth;
    const height = docEl.clientHeight;

    global.viewWidth = width;
    global.viewHeight = height;

    const grid = createPointGrid(width, height, r * 2.728, r * 2.3625);

    const startingHue = Stochator.randomInteger(0, 360);
    hueGenerator.setValue(startingHue);

    global.hue = startingHue;
    global.colorScale = createColorScale(hue);
    global.gridPoints = grid;
    global.polygons = generatePolygons(grid);
    global.fills = new Stochator().next(polygons.length);

    global.stepIncrement = 100;
    global.running = true;
    global.timer = null;
};

const initialize = () => {
    const svg = d3.select("#svg");

    svg.selectAll("polygon.cell")
        .data(polygons)
        .enter()
        .append("polygon")
        .attr("class", "cell")
        .attr("points", pointsToString)
        .attr("stroke-width", 1)
        .attr("stroke", colorScale(0))
        .attr("fill", (d, i) => colorScale(fills[i]));
};

const draw = (colorScale, fills, polygons) => {
    d3.select("body").style("background", colorScale(0));

    const cells = d3.select("#svg")
        .selectAll("polygon.cell")
        .data(polygons);

    cells.attr("points", pointsToString)
        .attr("stroke", colorScale(0))
        .attr("fill", (d, i) => colorScale(fills[i]));
};

const step = () => {
    if (running) {
        colorScale = createColorScale(hueGenerator.next());
        fills = mutateFills(fills);
        gridPoints = mutateGridPoints(gridPoints);
        polygons = generatePolygons(gridPoints);

        global.requestAnimationFrame(() => draw(colorScale, fills, polygons));
    }

    stepIncrement += Stochator.fromDistribution.normal(0.5, 0.01);
    global.timer = setTimeout(step, stepIncrement);
};

document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
});

// Click and drag interaction
let isDragging = false;

const distortPoints = (mouseX, mouseY, strength) => {
    const radius = 200;
    gridPoints = gridPoints.map(([x, y]) => {
        const dx = x - mouseX;
        const dy = y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius && dist > 0) {
            const force = strength * (1 - dist / radius);
            const angle = Math.atan2(dy, dx);
            return [
                x + Math.cos(angle) * force,
                y + Math.sin(angle) * force
            ];
        }
        return [x, y];
    });
    polygons = generatePolygons(gridPoints);
    draw(colorScale, fills, polygons);
};

document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#container')) return;
    isDragging = true;
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    distortPoints(e.clientX, e.clientY, 15);
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

// Touch support
document.addEventListener('touchstart', (e) => {
    if (e.target.closest('#container')) return;
    isDragging = true;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    distortPoints(touch.clientX, touch.clientY, 15);
}, { passive: true });

document.addEventListener('touchend', () => {
    isDragging = false;
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
