/* This object hold a curve which is linear by part and the method needed to 
 * do the bootstrapping
 */
class Curve {
  constructor(){
    this.reset();
  }

  /* Reset the curve */
  reset(){
    this.t = []; // timeStep
    this.r = []; // rate, r[0] is the rate between 0 and t[0]
  }

  /* Add a timeStep to the curve */
  add(t){
    this.t.push(t);
    this.r.push(0);
  }

  /* Compute a discount factor between 0 and T 
   * it's not an efficient method, because:
   * exp(a)*exp(b) == exp(a+b)
   * a multiplication is expensive, and an exponetial terrible
   * should use the right side of this equation and do one exp and some addition
   */
  df(T){
    if(!this.t.length)
      return 1;
    let df = 1;
    let t = 0;
    let ot = 0;
    let or = 0;
    let dt = 0;
    let r = 0;
    for(let i=0;i<this.t.length;i++){
      t = this.t[i];
      r = this.r[i]; // r is the rate between ot and t
      if(t > T)
        break;
      dt = t-ot;
      df *= Math.exp(-r*dt); // exp(-r*dt) is the discount factor between ot and t
      ot = t;
      or = r;
    }
    dt = T - (t<=T?t:ot);
    r = (t<=T?or:r);
    return df*Math.exp(-r*dt);
  }

  /* Compute the rate between 0 and T
   * it's not an efficient method, as we see above df is 'exp(something)' 
   * so to do 'log(exp(something))' is a waste of time
   */
  rate(T){
    return -Math.log(this.df(T))/T;
  }

  /* Determine what is the rate to use to make the price == 0
   * only the last timeStep can be modified
   * the algo used is a bisection, which is slow
   * a Brent or a Newton method would give better result
   */
  solve(price){
    let l = -1;
    let h = 1;
    let eps = 1e-10;
    let i = this.r.length-1;
    while(h-l > eps){
      let m = 0.5*(h+l);
      this.r[i] = m;
      let v = price();
      if(v > 0) l = m;
      else h = m;
    }
  }

  /* The bootstrap itself, we assume than the input 'swaps' is sorted by maturity
   * for each swap we add a timeStep, then we change the rate associated with 
   * this timeStep to make the price of the swap equal to 0
   */
  bootstrap(swaps){
    this.reset();
    swaps.forEach(swap => {
      this.add(swap.T);
      this.solve(() => swap.price(this));
    });
  }
}
