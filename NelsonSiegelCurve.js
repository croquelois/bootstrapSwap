/* Two dependencies: 
 * d3.js for the gaussian generator
 * numeric.js for the optimiser
 */

/* This object hold a nelson siegel (NS) curve
 * for more information about the formula which describe the dynamic of this
 * curve, check wikipedia
 */
class NelsonSiegelCurve {
  constructor(){
    this.reset();
  }

  /* This NS curve has 6 parameters
   * they are initialised randomly with a normal law
   * I use d3 random function, because I'm lazy
   */
  reset(){
    let rnd = d3.random.normal()
    this.b1 = rnd()*0.1;
    this.b2 = rnd()*0.1;
    this.b3 = rnd()*0.1;
    this.b4 = rnd()*0.1;
    this.l1 = rnd()*0.1;
    this.l2 = rnd()*0.1;
  }

  /* The NS formula itself, in the original formula l1 and l2 belong to the 
   * range [0,+inf]. But to use this formula without any constraint, in our
   * formulation l1 and l2 are the 'ln' version of the original one
   * so I need to transform them, it cost two additional exp
   */
  rate(t){
    let p = this;
    if(!t) return p.b1 + p.b2;
    let l1 = Math.exp(p.l1); // move from [-inf,+inf] to [0,+inf]
    let l2 = l1+Math.exp(p.l2); // move from [-inf,+inf] to [0,+inf]
    let tp1 = t/l1;
    let tp2 = t/l2;
    let e1 = Math.exp(-tp1);
    let e2 = Math.exp(-tp2);
    let f1 = (1-e1)/tp1;
    let f2 = f1-e1;
    let f3 = (1-e2)/tp2-e2;
    return p.b1 + p.b2*f1 + p.b3*f2 + p.b4*f3;
  }

  /* Computation of the discount factor based on the rate computed above */
  df(T){
    return Math.exp(-this.rate(T)*T);
  }

  /* This function will try to determine the set of parameter which minimise
   * the squared sum of the valuation of the swap in input
   * The optimisation use a BFGS algo taken from the numeric.js library 
   * it has some problem of local minimum, so we allow multiple try with random 
   * initial guess 
   */
  optimise(swaps,nbTry){
    let curve = this;
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
      return swaps.reduce(function(acc,swap){
        let p = swap.price(curve);
        return acc + p*p;
      },0);
    }
    // oracle function is the function to minimise
    function oracle(x){
      set(x);
      return score();
    };
    let guess = [curve.b1,curve.b2,curve.b3,curve.b4,curve.l1,curve.l2];
    let bestParam = guess;
    let bestScore = score();
    function oneTry(){
      try{
        let res = numeric.uncmin(oracle,guess); //BFGS
        if(res.f < bestScore){
          bestScore = res.f;
          bestParam = res.solution;
        }
      }catch(err){
        console.log(err);
      }
    }
    oneTry();
    for(let i=0;i<nbTry-1;i++){
      curve.reset();
      guess = [curve.b1,curve.b2,curve.b3,curve.b4,curve.l1,curve.l2];
      oneTry();    
    }
    set(bestParam);
  }
}