/* Two dependencies: 
 * d3.js for the gaussian generator
 * numeric.js for the optimiser
 */


/* This object represent a fix-float swap
 * the floating leg:
 * receive 1 at the beginning
 * pay a float rate all along
 * pay 1 at the end
 * the fixed leg:
 * pay 1 at the beginning
 * receive a fix coupon 'r' all along
 * receive 1 at the end
 */
function Swap(T,dt,r){
  this.T = T; // maturity
  this.dt = dt; // time between two coupon
  this.r = r; // fix rate to be payed
}

/* Following the hypothesis than our swap is with a risk free floating rate:
 * the floating leg worth 0
 * the fixed leg worth something and is computed in this function
 */
Swap.prototype.price = function(curve){
  var t = this.T;
  if(t < 0) return;
  var dt = this.dt;
  var r = this.r;
  var V = 1*curve.df(t); // receive 1 at the end
  while(t > 0){
    var C = r*(t<dt?t:dt);
    V += C*curve.df(t); // receive coupon of r*dt all along
    t -= dt;
  }
  return V-1; // pay 1 at the beginning
};

/* This object hold a curve which is linear by part and the method needed to 
 * do the bootstrapping
 */
function Curve(){
  this.reset();
}

/* Reset the curve */
Curve.prototype.reset = function(){
  this.t = []; // timeStep
  this.r = []; // rate, r[0] is the rate between 0 and t[0]
};

/* Add a timeStep to the curve */
Curve.prototype.add = function(t){
  this.t.push(t);
  this.r.push(0);
};

/* Compute a discount factor between 0 and T 
 * it's not an efficient method, because:
 * exp(a)*exp(b) == exp(a+b)
 * a multiplication is expensive, and an exponetial terrible
 * should use the right side of this equation and do one exp and some addition
 */
Curve.prototype.df = function(T){
  if(!this.t.length) return 1;
  var df = 1;
  var t = 0;
  var ot = 0;
  var or = 0;
  var dt = 0;
  var r = 0;
  for(var i=0;i<this.t.length;i++){
    t = this.t[i];
    r = this.r[i]; // r is the rate between ot and t
    if(t > T) break;
    dt = t-ot;
    df *= Math.exp(-r*dt); // exp(-r*dt) is the discount factor between ot and t
    ot = t;
    or = r;
  }
  dt = T - (t<=T?t:ot);
  r = (t<=T?or:r);
  return df*Math.exp(-r*dt);
};

/* Compute the rate between 0 and T
 * it's not an efficient method, as we see above df is 'exp(something)' 
 * so to do 'log(exp(something))' is a waste of time
 */
Curve.prototype.rate = function(T){
  return -Math.log(this.df(T))/T;
};

/* Determine what is the rate to use to make the price == 0
 * only the last timeStep can be modified
 * the algo used is a bisection, which is slow
 * a Brent or a Newton method would give better result
 */
Curve.prototype.solve = function(price){
  var l = -1;
  var h = 1;
  var eps = 1e-10;
  var i = this.r.length-1;
  while(h-l > eps){
    var m = 0.5*(h+l);
    this.r[i] = m;
    var v = price();
    if(v > 0) l = m;
    else h = m;
  }
};

/* The bootstrap itself, we assume than the input 'swaps' is sorted by maturity
 * for each swap we add a timeStep, then we change the rate associated with 
 * this timeStep to make the price of the swap equal to 0
 */
Curve.prototype.bootstrap = function(swaps){
  this.reset();
  swaps.forEach(function(swap){
    this.add(swap.T);
    this.solve(swap.price.bind(swap,this));
  },this);
};

/* This object hold a nelson siegel (NS) curve
 * for more information about the formula which describe the dynamic of this
 * curve, check wikipedia
 */
function NSCurve(){
  this.reset();
}

/* This NS curve has 6 parameters
 * they are initialised randomly with a normal law
 * I use d3 random function, because I'm lazy
 */
NSCurve.prototype.reset = function(){
  var rnd = d3.random.normal()
  this.b1 = rnd()*0.1;
  this.b2 = rnd()*0.1;
  this.b3 = rnd()*0.1;
  this.b4 = rnd()*0.1;
  this.l1 = rnd()*0.1;
  this.l2 = rnd()*0.1;
};

/* The NS formula itself, in the original formula l1 and l2 belong to the 
 * range [0,+inf]. But to use this formula without any constraint, in our
 * formulation l1 and l2 are the 'ln' version of the original one
 * so I need to transform them, it cost two additional exp
 */
NSCurve.prototype.rate = function(t){
  var p = this;
  if(!t) return p.b1 + p.b2;
  var l1 = Math.exp(p.l1); // move from [-inf,+inf] to [0,+inf]
  var l2 = l1+Math.exp(p.l2); // move from [-inf,+inf] to [0,+inf]
  var tp1 = t/l1;
  var tp2 = t/l2;
  var e1 = Math.exp(-tp1);
  var e2 = Math.exp(-tp2);
  var f1 = (1-e1)/tp1;
  var f2 = f1-e1;
  var f3 = (1-e2)/tp2-e2;
  return p.b1 + p.b2*f1 + p.b3*f2 + p.b4*f3;
};

/* Computation of the discount factor based on the rate computed above */
NSCurve.prototype.df = function(T){
  return Math.exp(-this.rate(T)*T);
};

/* This function will try to determine the set of parameter which minimise
 * the squared sum of the valuation of the swap in input
 * The optimisation use a BFGS algo taken from the numeric.js library 
 * it has some problem of local minimum, so we allow multiple try with random 
 * initial guess 
 */
NSCurve.prototype.optimise = function(swaps,nbTry){
  var curve = this;
  // transform an array of number, into the parameters of the curve
  function set(x){
    curve.b1 = x[0];
    curve.b2 = x[1];
    curve.b3 = x[2];
    curve.b4 = x[3];
    curve.l1 = x[4];
    curve.l2 = x[5];
  }
  // the score is the sum of the square of the price of each swap
  function score(){
    var ret = 0;
    swaps.forEach(function(swap){
      var p = swap.price(curve);
      ret += p*p;
    });
    return ret;
  }
  // oracle function is the function to minimise
  var oracle = function(x){
    set(x);
    return score();
  };
  var guess = [curve.b1,curve.b2,curve.b3,curve.b4,curve.l1,curve.l2];
  var bestParam = guess;
  var bestScore = score();
  function oneTry(){
    try{
      var res = numeric.uncmin(oracle,guess); //BFGS
      if(res.f < bestScore){
        bestScore = res.f;
        bestParam = res.solution;
      }
    }catch(err){
      console.log(err);
    }
  }
  oneTry();
  for(var i=0;i<nbTry-1;i++){
    curve.reset();
    guess = [curve.b1,curve.b2,curve.b3,curve.b4,curve.l1,curve.l2];
    oneTry();    
  }
  set(bestParam);
};