let abs = Math.abs;
let sqrt = Math.sqrt;
let pow = Math.pow;
let ln = Math.log;
let exp = Math.exp;
let width = 960, height = 500;

function affine(fct,arrX,n){
  function affineInner(x0,y0,x2,y2,n){
    if(!n)
      return [x0, x2];
    let x1 = (x0+x2)/2;
    let py1 = (y0+y2)/2;
    let y1 = fct(x1);
    if(abs(py1 - y1) < 0.0001)
      return [x0, x2];
    let p1 = affineInner(x0,y0,x1,y1,n-1);
    let p2 = affineInner(x1,y1,x2,y2,n-1);
    return p1.concat(p2.slice(1));
  }
  let p = [arrX[0]];
  for(let i=1;i<arrX.length;i++){
    let p2 = affineInner(arrX[i-1],fct(arrX[i-1]),arrX[i],fct(arrX[i]),n);
    p = p.concat(p2.slice(1));
  }
  return p.map(x => ({x:x,y:fct(x)}));
}

window.onload = function() {
  let color = d3.scale.category20();
  let svg = d3.select("#graph").append("svg")
      .attr("width", width)
      .attr("height", height);
  let rnd = d3.random.normal();
  let T = 20;
  let pad = 0;
  let maxRate = 0.05;
  let minRate = -0.01;
  let x = d3.scale.linear().domain([0,T]).range([0, width]),
      y = d3.scale.linear().domain([minRate,maxRate]).range([height, 0]);    
  let line = d3.svg.line().x(d => x(d.x)).y(d => y(d.y));//.interpolate("bundle");
  function drawHLine(y,col){
    let svgLine = svg.append("path")
      .style("fill", "none")
      .style("stroke", col)
      .style("stroke-width", "1px")
      .style("stroke-linecap", "round")
      .attr("class", "path");
    svgLine.attr("d", line([{x:0,y:y},{x:T,y:y}]));
  }  
  function drawVLine(x,col){
    let svgLine = svg.append("path")
      .style("fill", "none")
      .style("stroke", col)
      .style("stroke-width", "1px")
      .style("stroke-linecap", "round")
      .attr("class", "path");
    svgLine.attr("d", line([{x:x,y:minRate},{x:x,y:maxRate}]));
  }  
  function range(from,to,step){
    let ret = [];
    for(let i = from;i<to;i+=step) ret.push(i);
    ret.push(to);
    return ret;
  }  
  range(minRate,maxRate,0.0025).forEach(d => drawHLine(d,"gray"));
  range(minRate,maxRate,0.01).forEach(d => drawHLine(d,"black"));
  drawHLine(0,"red");
  [1.0,2.0,3.0,4.0,5.0,6.0,7.0,10.0,15.0,20.0].forEach(d => drawVLine(d,"gray"));
  let svgRate = svg.append("path")
    .style("fill", "none")
    .style("stroke", "green")
    .style("stroke-width", "2px")
    .style("stroke-linecap", "round")
    .attr("class", "path"); 
  let svgRate2 = svg.append("path")
    .style("fill", "none")
    .style("stroke", "blue")
    .style("stroke-width", "2px")
    .style("stroke-linecap", "round")
    .attr("class", "path"); 
  let dragged = null;
  let draggedData = null;
  let draggedFixT = false;
  function point(t,r,fixT){
    let ret = new Swap(t,0.5,r);
    let shape = svg.append("circle")
      .attr("class", "points")
      .attr("cx",x(t))
      .attr("cy",y(r))
      .attr("r",10);
    shape.on("mousedown.drag", function(){
      shape.attr("class", "points-focus")
      dragged = shape;
      draggedData = ret;
      draggedFixT = fixT;
    });
    return ret;
  }

  let curve = new Curve();
  let nscurve = new NelsonSiegelCurve();
  let rateCurve = curve.rate.bind(curve);
  let rateCurve2 = nscurve.rate.bind(nscurve);
  
  let swaps = [];
  swaps.push(point( 1, -0.005, true));
  swaps.push(point( 2, -0.002, true));
  swaps.push(point( 3,  0.005, true));
  swaps.push(point( 4,  0.007, true));
  swaps.push(point( 5,  0.010, true));
  swaps.push(point( 7,  0.012, true));
  swaps.push(point(10,  0.013, true));
  swaps.push(point(15,  0.014, true));
  swaps.push(point(20,  0.015, true));
  let timeStep = [0.01].concat(swaps.map(swap => swap.T));
  
  svg.on("mousemove.drag", function(){
    let p = d3.mouse(this);
    if(dragged){
      if(!draggedFixT){
        let cx = Math.max(pad, Math.min(width-pad, p[0]));
        dragged.attr("cx", cx);
        draggedData.T = x.invert(cx);
      }
      let cy = Math.max(pad, Math.min(height-pad, p[1]));
      dragged.attr("cy", cy);
      draggedData.r = y.invert(cy);
      curve.bootstrap(swaps);
      svgRate.attr("d", line(affine(rateCurve,timeStep,10)));
      nscurve.optimise(swaps,1);
      svgRate2.attr("d", line(affine(rateCurve2,timeStep,10)));
    }
  });
  svg.on("mouseup.drag", function(){
    if(dragged){
      dragged.attr("class", "points");
      dragged = null;
      nscurve.optimise(swaps,10);
      svgRate2.attr("d", line(affine(rateCurve2,timeStep,10)));
    }
  });
  
  curve.bootstrap(swaps);
  svgRate.attr("d", line(affine(rateCurve,timeStep,10)));
  nscurve.optimise(swaps);
  svgRate2.attr("d", line(affine(rateCurve2,timeStep,10)));
};