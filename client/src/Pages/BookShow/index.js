// Import necessary libraries
import { message } from "antd";
import moment from "moment";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { GetShowById } from "../../apicalls/theatres";
import { HideLoading, ShowLoading } from "../../redux/loadersSlice";
import { BookShowTickets, CreatePaymentIntent } from "../../apicalls/bookings";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Button from "../../Components/Button";

// Load Stripe
const stripePromise = loadStripe("pk_test_51RHrryIR1YPMOYefKOGj3GACQOtG8aPEO7okGnuPbQ6mEsVBVEqV3ZCehSaBrQLMrTzP2RZIIzPSCOllFE25sLq9002fZyQQ5Z");

// Payment form
function CheckoutForm({ amount, selectedSeats, show, user, params, navigate, dispatch }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    try {
      dispatch(ShowLoading());

      const response = await CreatePaymentIntent(amount);
      if (!response.success) throw new Error(response.message);

      const clientSecret = response.clientSecret;

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (result.error) {
        message.error(result.error.message);
      } else {
        if (result.paymentIntent.status === "succeeded") {
          message.success("Payment successful");
          await book(result.paymentIntent.id);
        }
      }

      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  const book = async (transactionId) => {
    try {
      dispatch(ShowLoading());
      const response = await BookShowTickets({
        show: params.id,
        seats: selectedSeats,
        transactionId,
        user: user._id,
      });
      if (response.success) {
        message.success(response.message);
        navigate("/profile");
      } else {
        message.error(response.message);
      }
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 card p-4 w-full max-w-md">
      <CardElement
        options={{
          style: {
            base: {
              fontSize: "16px",
              color: "#32325d",
              fontFamily: "Arial, sans-serif",
              "::placeholder": {
                color: "#a0aec0",
              },
            },
            invalid: {
              color: "#e53e3e",
            },
          },
        }}
      />
      <Button title="Pay and Book Now" type="submit" />
    </form>
  );
}

// Main component
function BookShow() {
  const { user } = useSelector((state) => state.users);
  const [show, setShow] = React.useState(null);
  const [selectedSeats, setSelectedSeats] = React.useState([]);
  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const getData = async () => {
    try {
      dispatch(ShowLoading());
      const response = await GetShowById({ showId: params.id });
      if (response.success) {
        setShow(response.data);
      } else {
        message.error(response.message);
      }
      dispatch(HideLoading());
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  const getSeats = () => {
    const columns = 12;
    const totalSeats = show.totalSeats;
    const rows = Math.ceil(totalSeats / columns);

    return (
      <div className="flex gap-1 flex-col p-2 card">
        {Array.from(Array(rows).keys()).map((seat) => (
          <div className="flex gap-1 justify-center" key={seat}>
            {Array.from(Array(columns).keys()).map((column) => {
              const seatNumber = seat * columns + column + 1;
              let seatClass = "seat";

              if (selectedSeats.includes(seatNumber)) seatClass += " selected-seat";
              if (show.bookedSeats.includes(seatNumber)) seatClass += " booked-seat";

              return (
                seatNumber <= totalSeats && (
                  <div
                    key={seatNumber}
                    className={seatClass}
                    onClick={() => {
                      if (selectedSeats.includes(seatNumber)) {
                        setSelectedSeats(selectedSeats.filter((item) => item !== seatNumber));
                      } else {
                        setSelectedSeats([...selectedSeats, seatNumber]);
                      }
                    }}
                  >
                    <h1 className="text-sm">{seatNumber}</h1>
                  </div>
                )
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    getData();
  }, []);

  return (
    show && (
      <div className="flex flex-col items-center p-4">
        {/* Show Info */}
        <div className="flex justify-between card p-4 w-full max-w-4xl mb-6">
          <div>
            <h1 className="text-sm">{show.theatre.name}</h1>
            <h1 className="text-sm">{show.theatre.address}</h1>
          </div>
          <div>
            <h1 className="text-2xl uppercase">{show.movie.title} ({show.movie.language})</h1>
          </div>
          <div>
            <h1 className="text-sm">
              {moment(show.date).format("MMM Do YYYY")} - {moment(show.time, "HH:mm").format("hh:mm A")}
            </h1>
          </div>
        </div>

        {/* Seats */}
        <div className="flex justify-center">{getSeats()}</div>

        {/* Payment */}
        {selectedSeats.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-4 w-full max-w-4xl">
            <div className="flex justify-between uppercase card p-4 w-full">
              <h1 className="text-sm"><b>Selected Seats:</b> {selectedSeats.join(", ")}</h1>
              <h1 className="text-sm"><b>Total Price:</b> {selectedSeats.length * show.ticketPrice} USD</h1>
            </div>

            <Elements stripe={stripePromise}>
              <CheckoutForm
                amount={selectedSeats.length * show.ticketPrice * 100}
                selectedSeats={selectedSeats}
                show={show}
                user={user}
                params={params}
                navigate={navigate}
                dispatch={dispatch}
              />
            </Elements>
          </div>
        )}
      </div>
    )
  );
}

export default BookShow;
