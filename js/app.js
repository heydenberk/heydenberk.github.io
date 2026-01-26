const global = window;
const docEl = document.documentElement;

const createPointGrid = (width, height, spacingX, spacingY) => {
    let currentY = -spacingY;
    let points = [];
    while (currentY < height + spacingY * 2) {
        let row = Math.floor(currentY / spacingY);
        let currentX = row % 2 === 0 ? -spacingX : -spacingX / 2;
        while (currentX < width + spacingX * 2) {
            points.push([currentX, currentY]);
            currentX += spacingX;
        }
        currentY += spacingY;
    }
    return points;
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

const cellSpacing = 80;

const [minSaturation, maxSaturation] = [0.25, 0.3];
const [minLightness, maxLightness] = [0.8, 0.92];

const mutateFills = fills => _.map(fills, (fill) =>
    fill + Stochator.fromDistribution.normal(0, 0.001));

const pointMutator = new Stochator(
    {}, {mean: 0, min: -20, max: 20, stdev: 10},
    ([threshold, change]) => threshold > 0.999 ? change : 0);

const mutatePoints = points => points.map(
    ([x, y]) => [x + pointMutator.next(), y + pointMutator.next()]);

const computeVoronoi = (points, width, height) => {
    const voronoi = d3.voronoi()
        .extent([[-1, -1], [width + 1, height + 1]]);

    const diagram = voronoi(points);
    return diagram.polygons().map(cell => cell || []);
};

const initializeGlobalState = () => {
    const width = docEl.clientWidth;
    const height = docEl.clientHeight;

    global.viewWidth = width;
    global.viewHeight = height;

    const grid = createPointGrid(width, height, cellSpacing * 1.5, cellSpacing * 1.3);

    const startingHue = Stochator.randomInteger(0, 360);
    hueGenerator.setValue(startingHue);

    const startingFills = new Stochator().next(grid.length);

    global.hue = startingHue;
    global.colorScale = createColorScale(hue);
    global.fills = startingFills;
    global.points = grid;
    global.basePoints = grid.map(p => [...p]);
    global.polygons = computeVoronoi(grid, width, height);

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
        points = mutatePoints(points);
        polygons = computeVoronoi(points, viewWidth, viewHeight);

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
    points = points.map(([x, y]) => {
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
    polygons = computeVoronoi(points, viewWidth, viewHeight);
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
