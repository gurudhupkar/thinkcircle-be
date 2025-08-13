import express from "express"


const app = express();
app.use(express.json())

const port = 3000


app.get("/" , (req ,res)=>{
    res.status(200).json({
        message:"Server is up and running",
        success:true
    })
})

app.listen(port ,()=>{
    console.log(`Server is running on ${port}`)
})