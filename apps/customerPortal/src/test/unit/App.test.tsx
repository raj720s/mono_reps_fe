import {render,screen} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import  App  from "../../App"

describe("App",()=>{
    it("renders the App Button", async ()=>{
        window.alert = jest.fn() // Mock the alert function
        render(<App/>)
        const buttonElement = screen.getByRole("button",{name:/click me/i})
        expect(buttonElement).toBeInTheDocument()
        await userEvent.click(buttonElement)
   
    })
})
