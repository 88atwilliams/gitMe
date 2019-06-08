
/**
 * bringBackFive Method is used to filter the max length of an array to 5.
 * @param {*} array 
 */
const bringLimitBack = (array, limit)=>{
    if(limit>5){
        res.status(400).json({
            message: "max limit is 5. Please try again with a lower limit"
        })
    }
    return array.filter((_,index)=> index< limit)
}
module.exports = bringLimitBack